import { Trajectory, TrajectoryConfig, TrajectoryPart } from "@trajs/core";
import { Part } from "@trajs/core/Exchange";
import { TrajectoryError } from "@trajs/core/TrajectoryError";
import { DateTime, Effect, Match, Schema, Stream } from "effect";
import { SqlError } from "effect/sql/SqlError";

import { Client } from "#/Clickhouse.ts";
import type { Encoded, Row } from "#/Parts.ts";

/** The name of the table the rows are written into. */
export const tableName = "parts";

/**
 * The paths of a part stated as subcolumns of their own, which a query reads
 * rather than inferring their type per block.
 *
 * These are the paths a query aggregates over: the model a response was produced
 * by, the tool a call named, and the two totals of what the response used.
 */
const typedPaths = [
  "`response.modelId` LowCardinality(String)",
  "`response.name` LowCardinality(String)",
  "`response.usage.inputTokens.total` UInt32",
  "`response.usage.outputTokens.total` UInt32",
].join(",\n    ");

/** The statement that creates {@link tableName}, as ClickHouse is asked for it. */
export const createTableStatement = `CREATE TABLE IF NOT EXISTS ${tableName} (
    trajectory_id String,
    position UInt32,
    tag LowCardinality(String),
    variant LowCardinality(String),
    session_id LowCardinality(String),
    uuid Nullable(UUID),
    time Nullable(DateTime64(3, 'UTC')),
    part JSON(max_dynamic_paths = 64, ${typedPaths})
  )
  ENGINE = ReplacingMergeTree
  ORDER BY (trajectory_id, position)`;

/** The moment `timestamp` states, as ClickHouse reads one, and `null` where it states none. */
const formatMoment = (timestamp: DateTime.Utc | undefined): string | null =>
  timestamp === undefined ? null : DateTime.formatIso(timestamp);

/**
 * The session a part states, or the main session where it states none.
 *
 * {@link TrajectoryPart.mainSessionId} states the rule a part that names no session
 * of its own follows.
 */
const statedSession = (part: { readonly sessionId?: string }): string =>
  part.sessionId ?? TrajectoryPart.mainSessionId;

/**
 * The columns a row states beside its payload, which every kind of part states its
 * own variant and session of.
 */
const columns = (
  part: Readonly<{ _tag: string; uuid?: string | null; timestamp?: DateTime.Utc }>,
  stated: Readonly<{ variant: string; session: string }>,
): Omit<Row, "trajectory_id" | "position" | "part"> => ({
  tag: part._tag,
  variant: stated.variant,
  session_id: stated.session,
  uuid: part.uuid ?? null,
  time: formatMoment(part.timestamp),
});

/**
 * What a part states of itself in the columns beside its payload.
 *
 * A session part declares the session, so its row is filed under the id it
 * declares, and a metric part states no session of its own: its row states none,
 * since a query reaches it through the parts it attaches to. Every kind of part is
 * stated, so a kind added to a trajectory fails here rather than writing a row of
 * nothing.
 */
const statedColumns = (part: TrajectoryPart.Part<TrajectoryConfig.AnyConfig>) =>
  Match.valueTags(part, {
    Prompt: (part) => columns(part, { variant: "", session: statedSession(part) }),
    Session: (part) => columns(part, { variant: "", session: part.type.id }),
    Response: (part) =>
      columns(part, { variant: part.response.type, session: statedSession(part) }),
    Event: (part) => columns(part, { variant: part.event._tag, session: statedSession(part) }),
    Metric: (part) => columns(part, { variant: part.metric._tag, session: "" }),
  });

/** The row `part` makes at `position` of `trajectoryId`, carrying `payload`. */
const makeRow = (
  trajectoryId: string,
  position: number,
  part: TrajectoryPart.Part<TrajectoryConfig.AnyConfig>,
  payload: Encoded,
): Row => ({ trajectory_id: trajectoryId, position, ...statedColumns(part), part: payload });

/**
 * The parts of `trajectory` as the rows of {@link tableName}, in the order they
 * arrive.
 *
 * The payload of a row is written as JSON, so a part becomes one as JSON states it
 * rather than as the exchange writes it: `Schema.toCodecJson` is the canonical JSON
 * form of a schema, which states a value JSON has no form of — the bytes of a media
 * part, a moment — as a string rather than as an object of its fields.
 *
 * TODO: the bytes of a media part travel inline, as the base64 string a `JSON`
 * column holds them as. A storage service a program gives `Parts.rows` — the
 * way the exchange is given one to keep the bytes of a `.trajs` file — would hold
 * them outside the row, and a payload would carry the reference a query reaches them
 * by.
 */
export const partRows = <C extends TrajectoryConfig.AnyConfig, E, R>(
  trajectory: Trajectory.Trajectory<string, C, E, R>,
): Stream.Stream<Row, E | TrajectoryError, R | TrajectoryConfig.EncodingServices<C>> => {
  const encode = Part(trajectory).pipe(Schema.toCodecJson, Schema.encodeEffect);

  // Every row of one reading is of the trajectory it is read from, named by the id
  // that trajectory carries.
  const { id } = trajectory;

  return trajectory.pipe(
    Stream.zipWithIndex,
    Stream.mapEffect(([part, position]) =>
      encode(part).pipe(
        Effect.mapError(TrajectoryError.parse),
        // SAFETY: what a part encodes to is an object — the part with its `_tag` —
        // so the JSON it states is a JSON object rather than any JSON value.
        Effect.map((encoded) => makeRow(id, position, part, encoded as Encoded)),
      ),
    ),
  );
};

/**
 * How many rows are written in one insert.
 *
 * ClickHouse wants inserts few and large rather than many and small: every insert
 * is a part of its own before a merge joins it to the others, and a table of many
 * small parts is a table that reads slowly.
 */
const batchSize = 4_096;

/** How many batches are inserted at a time. */
const concurrency = 2;

/** The rows written into {@link tableName} in batches, and how many were sent. */
export const writeRows = <E, R>(
  rows: Stream.Stream<Row, E, R>,
): Effect.Effect<number, E | SqlError, R | Client> =>
  Effect.gen(function* () {
    const ch = yield* Client;

    return yield* rows.pipe(
      Stream.grouped(batchSize),
      Stream.mapEffect(
        (batch) =>
          ch.insertQuery({ table: tableName, values: batch }).pipe(Effect.as(batch.length)),
        { concurrency },
      ),
      Stream.runFold(
        () => 0,
        (written: number, count: number) => written + count,
      ),
    );
  });
