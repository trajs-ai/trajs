/**
 * Trajectories held as files.
 *
 * {@link Exchange} reads one by id, and {@link layerFileSystem} provides it
 * from the file system. {@link fromBytes} reads one from a sequence of bytes.
 *
 * @stability stable
 */

import { Bytes, Compression } from "@trajs/utils";
import { Effect } from "effect";
import { Hex } from "effect/encoding";

import * as EventKit from "#/EventKit.ts";
import * as ExchangeIssue from "#/ExchangeIssue.ts";
import * as ExtraKit from "#/ExtraKit.ts";
import * as reader from "#/internal/exchange/read.ts";
import * as MetricKit from "#/MetricKit.ts";
import * as Toolkit from "#/Toolkit.ts";
import * as Trajectory from "#/Trajectory.ts";
import * as TrajectoryConfig from "#/TrajectoryConfig.ts";
import { TrajectoryError } from "#/TrajectoryError.ts";

export interface Metadata {
  id: string;
  version: string;
  digest: string;
  length: number;
  fileSize: bigint;
}

export interface KitSchemas {
  toolkit: Toolkit.ToolkitSchema;
  eventkit: EventKit.EventKitSchema;
  metrickit: MetricKit.MetricKitSchema;
  extrakit: ExtraKit.ExtraKitSchema;
}

export const read =
  <Config extends TrajectoryConfig.AnyConfig>(config: Config) =>
  <E, R>(
    bytes: Bytes.Bytes<E, R>,
  ): Effect.Effect<
    Trajectory.TrajectoryFile<
      string,
      Config,
      TrajectoryError,
      TrajectoryConfig.SchemaServices<Config>
    >,
    TrajectoryError | ExchangeIssue.Issue | E,
    TrajectoryConfig.SchemaServices<Config> | Compression.Compression | R
  > => {
    throw new Error("Not implemented");
  };

export const write = <Config extends TrajectoryConfig.AnyConfig, E, R>(
  trajectory: Trajectory.Trajectory<string, Config, E, R>,
): Effect.Effect<
  Bytes.Bytes<TrajectoryError | E, R>,
  TrajectoryError | ExchangeIssue.Issue | E,
  TrajectoryConfig.SchemaServices<Config> | R
> => {
  throw new Error("Not implemented");
};

/**
 * Reads what a stored trajectory states of itself, without reading its parts.
 *
 * **When to use**
 *
 * Use to name or list a trajectory from its bytes alone.
 *
 * **Details**
 *
 * `id` and `version` are the ones the header states.
 * `digest` is the digest the footer records, as lowercase hex.
 * `length` counts the parts the footer states.
 * `fileSize` is how many bytes the sequence holds.
 *
 * @see {@link inspectKitSchemas} for the kits the header states.
 * @stability stable
 * @category constructors
 */
export const inspectMetadata = <E, R>(
  bytes: Bytes.Bytes<E, R>,
): Effect.Effect<Metadata, TrajectoryError | E, R> =>
  Effect.gen(function* () {
    const fileSize = yield* bytes.length;

    const header = yield* reader.readHeader(bytes, fileSize);
    const { footer } = yield* reader.readFooter(bytes, fileSize);

    return {
      id: header.id,
      version: header.version,
      digest: Hex.encode(footer.chain),
      length: footer.chunks.reduce((sum, entry) => sum + entry.count, 0),
      fileSize,
    };
  });

/**
 * Reads the kits a stored trajectory was written with.
 *
 * **When to use**
 *
 * Use to learn how a file is stored before any of its parts is read.
 *
 * **Details**
 *
 * Each record holds the declarations one kit stored, keyed by their keys.
 *
 * @stability stable
 * @category constructors
 */
export const inspectKitSchemas = <E, R>(
  bytes: Bytes.Bytes<E, R>,
): Effect.Effect<KitSchemas, TrajectoryError | E, R> =>
  Effect.gen(function* () {
    const fileSize = yield* bytes.length;

    const header = yield* reader.readHeader(bytes, fileSize);

    return {
      toolkit: header.toolkit,
      eventkit: header.eventkit,
      metrickit: header.metrickit,
      extrakit: header.extrakit,
    };
  });
