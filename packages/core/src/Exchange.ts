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
import type { JsonObject } from "effect/Schema";

import * as Config from "#/Config.ts";
import * as ExchangeIssue from "#/ExchangeIssue.ts";
import * as Trajectory from "#/Trajectory.ts";
import { TrajectoryError } from "#/TrajectoryError.ts";

export interface Metadata {
  id: string;
  version: string;
  digest: string;
  length: number;
  fileSize: bigint;
}

export interface KitSchemas {
  toolkit: Record<string, JsonObject>;
  eventkit: Record<string, JsonObject>;
  metrickit: Record<string, JsonObject>;
  extrakit: Record<string, JsonObject>;
}

export const read =
  <Config extends Config.AnyConfig>(config: Config) =>
  <R>(
    bytes: Bytes.Bytes<TrajectoryError, R>,
  ): Effect.Effect<
    Trajectory.TrajectoryFile<string, Config, TrajectoryError, Config.SchemaServices<Config>>,
    TrajectoryError | ExchangeIssue.Issue,
    Config.SchemaServices<Config> | Compression.Compression | R
  > => {
    throw new Error("Not implemented");
  };

export const write = <Config extends Config.AnyConfig, E, R>(
  trajectory: Trajectory.Trajectory<string, Config, E, R>,
): Effect.Effect<
  Bytes.Bytes<TrajectoryError, R>,
  E | TrajectoryError | ExchangeIssue.Issue,
  R | Config.SchemaServices<Config>
> => {
  throw new Error("Not implemented");
};

export const inspectMetadata = <R>(
  bytes: Bytes.Bytes<TrajectoryError, R>,
): Effect.Effect<Metadata, ExchangeIssue.Issue, R> => {
  throw new Error("Not implemented");
};

export const inspectKitSchemas = <R>(
  bytes: Bytes.Bytes<TrajectoryError, R>,
): Effect.Effect<KitSchemas, ExchangeIssue.Issue, R> => {
  throw new Error("Not implemented");
};
