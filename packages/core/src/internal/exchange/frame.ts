import { Effect, Match, Schema } from "effect";
import { SchemaBinary } from "effect/encoding";

import * as part from "#/internal/exchange/part.ts";
import type * as TrajectoryConfig from "#/TrajectoryConfig.ts";
import { TrajectoryError } from "#/TrajectoryError.ts";
import type * as TrajectoryPart from "#/TrajectoryPart.ts";

/** One part's two stored segments: the meta a scan reads alone, and the body it pairs. */
export interface Frame {
  readonly meta: Uint8Array;
  readonly body: Uint8Array;
}

/** Reads the bytes of one stored segment as the value `schema` states. */
const decodeSegment =
  <S extends Schema.Constraint>(schema: S) =>
  (bytes: Uint8Array) =>
    Schema.decodeUnknownEffect(SchemaBinary.toCodec(schema))(bytes).pipe(
      Effect.mapError(TrajectoryError.parse),
    );

/** The two halves are one stored struct split in two, so joining them states the part. */
const joined = <M extends object, B extends object>(meta: M, body: B): M & B => ({
  ...meta,
  ...body,
});

/**
 * Reads a frame as the part its meta states. The tag picks the schema the body is
 * read with, and the halves join back to the part.
 */
export const decodeFrame = <C extends TrajectoryConfig.AnyConfig>(config: C) => {
  const decodeMeta = decodeSegment(part.Meta);

  const bodies = {
    Prompt: part.PromptPartBody(config.extrakit),
    Session: part.SessionPartBody(config.extrakit),
    Response: part.ResponsePartBody(config.toolkit, config.extrakit),
    Event: part.EventPartBody(config.eventkit),
    Metric: part.MetricPartBody(config.metrickit),
  };

  return (
    frame: Frame,
  ): Effect.Effect<TrajectoryPart.Part<C>, TrajectoryError, TrajectoryConfig.DecodingServices<C>> =>
    // SAFETY: every body is read with the config's own kits, so the config's
    // services cover them, and the halves join to the part its tag names.
    Effect.gen(function* () {
      const meta = yield* decodeMeta(frame.meta);
      const body = yield* decodeSegment(bodies[meta._tag])(frame.body);

      const stored = joined(meta, body);

      return Match.value(meta).pipe(
        Match.tag("Metric", () =>
          // SAFETY: the meta names the metric whose result the body holds;
          // stored apart, no type pairs them.
          part.decodeMetricPart<C["metrickit"]>(
            stored as part.MetricPartMeta & part.MetricPartBodyEncoded,
          ),
        ),
        Match.orElse(() => stored),
      );
    }) as Effect.Effect<
      TrajectoryPart.Part<C>,
      TrajectoryError,
      TrajectoryConfig.DecodingServices<C>
    >;
};
