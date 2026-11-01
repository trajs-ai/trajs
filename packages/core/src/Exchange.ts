/**
 * Trajectories held as files.
 *
 * {@link Exchange} reads one by id, and {@link layerFileSystem} provides it
 * from the file system.
 *
 * @stability stable
 */

import { Compression } from "@trajs/utils";
import { Context, Effect, FileSystem, Layer, Match, Option, Path, Scope } from "effect";
import type { PlatformError } from "effect/PlatformError";
import type { JsonObject } from "effect/Schema";

import * as Config from "#/Config.ts";
import * as ExchangeIssue from "#/ExchangeIssue.ts";
import * as file from "#/internal/exchange/file.ts";
import * as Trajectory from "#/Trajectory.ts";
import { TrajectoryError } from "#/TrajectoryError.ts";

/**
 * A summary of a trajectory file, read without its parts.
 *
 * **Details**
 *
 * `id`, `version`, and the four kits are the file's own header.
 * `length` counts the parts, and `fileSize` the bytes holding them.
 * `digest` covers those bytes.
 *
 * @see {@link Exchange} for the `inspect` that reads one.
 * @stability stable
 * @category models
 */
export interface Inspection {
  id: string;
  version: string;
  toolkit: Record<string, JsonObject>;
  eventkit: Record<string, JsonObject>;
  metrickit: Record<string, JsonObject>;
  extrakit: Record<string, JsonObject>;
  digest: string;
  length: number;
  fileSize: bigint;
}

/**
 * A store holding whole trajectories by id, each as one file.
 *
 * **Details**
 *
 * `read` decodes the parts of one file with `config`.
 * `write` stores a trajectory as a file.
 * `inspect` states what a file holds without decoding any part.
 *
 * @see {@link Inspection} for what `inspect` returns.
 * @see {@link layerFileSystem} for a store of files on disk.
 * @stability stable
 * @category services
 */
export interface Exchange {
  read: <Config extends Config.AnyConfig>(
    config: Config,
  ) => <Id extends string>(
    id: Id,
  ) => Effect.Effect<
    Trajectory.TrajectoryFile<Id, Config, TrajectoryError, Config.SchemaServices<Config>>,
    TrajectoryError | ExchangeIssue.Issue,
    Config.SchemaServices<Config> | Compression.Compression
  >;

  write: <Id extends string, Config extends Config.AnyConfig, E, R>(
    trajectory: Trajectory.Trajectory<Id, Config, E, R>,
  ) => Effect.Effect<
    Trajectory.TrajectoryFile<Id, Config, TrajectoryError, Config.SchemaServices<Config>>,
    E | TrajectoryError | ExchangeIssue.Issue,
    R | Config.SchemaServices<Config>
  >;

  inspect: (id: string) => Effect.Effect<Option.Option<Inspection>, TrajectoryError>;
}

/**
 * The service a store of trajectories is provided through.
 *
 * @see {@link Exchange} for what the service gives.
 * @stability stable
 * @category tags
 */
export const Exchange = Context.Service<Exchange, Exchange>("trajs/Exchange");

/**
 * Creates an {@link Exchange} from a file system, one file per id.
 *
 * **Details**
 *
 * `pathOf` turns an id into a path, or into `null` for an id with no file.
 * A relative path is joined to `cwd`.
 *
 * **Gotchas**
 *
 * A file stays open for the scope of the layer.
 * `write` and `inspect` are not implemented yet, and die when called.
 *
 * @see {@link Exchange} for the store this layer provides.
 * @stability stable
 * @category layers
 */
export const layerFileSystem = ({
  cwd,
  pathOf = (id) => `${id}.trajs`,
}: {
  cwd?: string;
  pathOf?: (id: string) => string | null;
}): Layer.Layer<Exchange, never, FileSystem.FileSystem | Path.Path | Scope.Scope> =>
  Layer.effect(
    Exchange,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const scope = yield* Effect.scope;

      // A missing file reports the issue a `pathOf` naming no path reports.
      const openFailure =
        (id: string) =>
        (cause: PlatformError): TrajectoryError | ExchangeIssue.NotFound =>
          Match.value(cause.reason).pipe(
            Match.tag("NotFound", () => new ExchangeIssue.NotFound({ id })),
            Match.orElse(() => TrajectoryError.parse(cause)),
          );

      // The bytes of one trajectory, opened from its file.
      const bytesOf = (
        id: string,
      ): Effect.Effect<file.Bytes, TrajectoryError | ExchangeIssue.NotFound> =>
        Effect.gen(function* () {
          const path = pathOf(id);

          if (path === null) {
            return yield* Effect.fail(new ExchangeIssue.NotFound({ id }));
          }

          const resolved =
            cwd === undefined || paths.isAbsolute(path) ? path : paths.join(cwd, path);

          const opened = yield* fs
            .open(resolved)
            .pipe(Effect.provideService(Scope.Scope, scope), Effect.mapError(openFailure(id)));

          const { size } = yield* opened.stat.pipe(Effect.mapError(TrajectoryError.parse));

          // A read returns what it can, so the region is read until it is full.
          const readAt = (position: bigint, length: number) =>
            Effect.gen(function* () {
              const region = new Uint8Array(length);

              let filled = 0;

              while (filled < length) {
                const taken = yield* opened
                  .read(region.subarray(filled), { position: position + BigInt(filled) })
                  .pipe(Effect.mapError(TrajectoryError.parse));

                if (taken === 0) {
                  return yield* Effect.fail(
                    TrajectoryError.parse(new Error(`'${resolved}' ends before its bytes do`)),
                  );
                }

                filled += taken;
              }

              return region;
            });

          return { size, read: readAt };
        });

      const read =
        <C extends Config.AnyConfig>(config: C) =>
        <Id extends string>(id: Id) =>
          Effect.gen(function* () {
            const compression = yield* Compression.Compression;
            const buffer = yield* file.bufferOf(config, compression)(yield* bytesOf(id));

            return { ...config, id, ...buffer };
          });

      // TODO: writing and inspecting a file.
      return {
        read,
        write: () => Effect.die(new Error("Exchange.write")),
        inspect: () => Effect.die(new Error("Exchange.inspect")),
      };
    }),
  );
