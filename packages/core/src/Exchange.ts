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
 * `locate` turns an id into a path, or into `null` for an id with no file.
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
  locate = (id) => `${id}.trajs`,
}: {
  cwd?: string;
  locate?: (id: string) => string | null;
}): Layer.Layer<Exchange, never, FileSystem.FileSystem | Path.Path | Scope.Scope> =>
  Layer.effect(
    Exchange,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const scope = yield* Effect.scope;

      // A store that reports an id absent states what a locate that names no path does.
      const absent =
        (id: string) =>
        (cause: PlatformError): TrajectoryError | ExchangeIssue.NotFound =>
          Match.value(cause.reason).pipe(
            Match.tag("NotFound", () => new ExchangeIssue.NotFound({ id })),
            Match.orElse(() => TrajectoryError.parse(cause)),
          );

      // The bytes of one trajectory, as the file serves them.
      const serve = (id: string) =>
        Effect.gen(function* () {
          const located = locate(id);

          if (located === null) {
            return yield* Effect.fail(new ExchangeIssue.NotFound({ id }));
          }

          const path =
            cwd === undefined || paths.isAbsolute(located) ? located : paths.join(cwd, located);

          const opened = yield* fs
            .open(path)
            .pipe(Effect.provideService(Scope.Scope, scope), Effect.mapError(absent(id)));

          const { size } = yield* opened.stat.pipe(Effect.mapError(TrajectoryError.parse));

          // The file serves a region in as many reads as it states.
          const read = (position: bigint, size: number) =>
            Effect.gen(function* () {
              const bytes = new Uint8Array(size);

              let filled = 0;

              while (filled < size) {
                const taken = yield* opened
                  .read(bytes.subarray(filled), { position: position + BigInt(filled) })
                  .pipe(Effect.mapError(TrajectoryError.parse));

                if (taken === 0) {
                  return yield* Effect.fail(
                    TrajectoryError.parse(new Error(`'${path}' ends before its bytes do`)),
                  );
                }

                filled += taken;
              }

              return bytes;
            });

          return { size, read };
        });

      const read =
        <C extends Config.AnyConfig>(config: C) =>
        <Id extends string>(id: Id) =>
          Effect.gen(function* () {
            const buffer = yield* file.bufferOf(
              config,
              yield* Compression.Compression,
            )(yield* serve(id));

            return { ...config, id, ...buffer };
          });

      // TODO: writing and inspecting a file.
      const unimplemented = (name: string) => Effect.die(new Error(`Exchange.${name}`));

      return {
        read,
        write: () => unimplemented("write"),
        inspect: () => unimplemented("inspect"),
      };
    }),
  );
