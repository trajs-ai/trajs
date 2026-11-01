/**
 * Replayable trajectories backed by memory, a file system, or a key/value store.
 *
 * {@link Cache.cache} reads a source once and returns a {@link Trajectory.TrajectoryFile}.
 * {@link layerMemory}, {@link layerFileSystem}, and {@link layerKVStore} choose
 * the backing store.
 *
 * @stability stable
 */

import { Context, Data, Effect, FileSystem, Formatter, Layer, Option, Stream } from "effect";
import type { Path, PlatformError, Scope } from "effect";
import * as EffectCache from "effect/Cache";
import { KeyValueStore } from "effect/persistence";

import type * as Config from "#/Config.ts";
import { decodePart, encodePart } from "#/internal/exchange/part.ts";
import { configOf } from "#/internal/trajectory.ts";
import type * as Trajectory from "#/Trajectory.ts";
import type { TrajectoryError } from "#/TrajectoryError.ts";

/**
 * A backing-store failure while reading or writing a cached part.
 *
 * **Details**
 *
 * `id` names the trajectory and `index` is the zero-based index of the part.
 * `cause` retains the failure of the store.
 *
 * @see {@link layerKVStore} for the store these failures come from.
 * @stability stable
 * @category errors
 */
export class CacheError extends Data.TaggedError("CacheError")<{
  id: string;
  index: number;
  operation: "read" | "write";
  cause: unknown;
}> {
  override get message(): string {
    return `Failed to ${this.operation} part ${this.index} of '${this.id}': ${Formatter.format(this.cause)}`;
  }

  static read = (id: string, index: number) => (cause: unknown) =>
    new CacheError({ id, index, operation: "read", cause });

  static write = (id: string, index: number) => (cause: unknown) =>
    new CacheError({ id, index, operation: "write", cause });
}

/**
 * A cache reading a trajectory once and keeping its parts for replay.
 *
 * **When to use**
 *
 * Use when a source stream cannot be rerun, and its parts are read again.
 *
 * @see {@link layerMemory} for a cache holding every part in memory.
 * @see {@link layerKVStore} for a cache holding its parts in a store.
 * @stability stable
 * @category services
 */
export interface Cache {
  readonly cache: <Id extends string, Config extends Config.AnyConfig, E, R>(
    trajectory: Trajectory.Trajectory<Id, Config, E, R>,
  ) => Effect.Effect<
    Trajectory.TrajectoryFile<
      Id,
      Config,
      TrajectoryError | CacheError,
      Config.DecodingServices<Config>
    >,
    E | TrajectoryError | CacheError,
    R | Config.EncodingServices<Config>
  >;
}

/**
 * The service a cache is provided through.
 *
 * @see {@link Cache} for what the service gives.
 * @stability stable
 * @category tags
 */
export const Cache = Context.Service<Cache, Cache>()("trajs/core/Cache");

/**
 * Creates a {@link Cache} keeping its parts in a key/value store.
 *
 * **When to use**
 *
 * Use when cached parts must outlive the program, or are too many to hold.
 *
 * **Details**
 *
 * `capacity` is the size of the memory holding decoded parts, counted in parts
 * rather than bytes.
 * A part read again is the last to be dropped, and omission or `"unbounded"`
 * holds every part.
 * Reading the source runs to its end, and every part is encoded and kept under
 * `<id>/<index>`.
 * `at` decodes a part from the store, and keeps it from then on.
 *
 * **Gotchas**
 *
 * An id names the keys of its parts, so reading one trajectory over another's id
 * reads that one's parts.
 * A part kept again is written over the one the store held.
 *
 * @see {@link layerMemory} for a cache holding every part in memory.
 * @see {@link layerFileSystem} for the same cache over files on disk.
 * @stability stable
 * @category layers
 */
export const layerKVStore = (options?: {
  readonly capacity?: number | "unbounded";
}): Layer.Layer<Cache, never, KeyValueStore.KeyValueStore> => {
  const stated = options?.capacity;

  const capacity =
    stated === undefined || stated === "unbounded" ? Infinity : Math.max(0, Math.floor(stated));

  return Layer.effect(
    Cache,
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore;

      return {
        cache: <Id extends string, Config extends Config.AnyConfig, E, R>(
          trajectory: Trajectory.Trajectory<Id, Config, E, R>,
        ) =>
          Effect.gen(function* () {
            const config = configOf<Config>(trajectory);
            const encode = encodePart<Config>(config);
            const decode = decodePart<Config>(config);

            const parts = yield* EffectCache.make({
              capacity,
              requireServicesAt: "lookup",
              lookup: (index: number) =>
                Effect.gen(function* () {
                  const bytes = yield* store
                    .getUint8Array(`${trajectory.id}/${index}`)
                    .pipe(Effect.mapError(CacheError.read(trajectory.id, index)));

                  if (bytes === undefined) {
                    return yield* CacheError.read(
                      trajectory.id,
                      index,
                    )("the store holds no part at this index");
                  }

                  return yield* decode(bytes);
                }),
            });

            let length = 0;

            yield* trajectory.pipe(
              Stream.mapEffect((part) => {
                const index = length;

                length += 1;

                return encode(part).pipe(
                  Effect.flatMap((bytes) =>
                    store
                      .set(`${trajectory.id}/${index}`, bytes)
                      .pipe(Effect.mapError(CacheError.write(trajectory.id, index))),
                  ),
                );
              }),
              Stream.runDrain,
            );

            return {
              ...config,
              id: trajectory.id,
              length,
              at: (index: number) =>
                index < 0 || index >= length
                  ? Effect.succeed(Option.none<Trajectory.Part<Config>>())
                  : EffectCache.get(parts, index).pipe(Effect.map(Option.some)),
            };
          }),
      };
    }),
  );
};

/**
 * Creates a {@link Cache} keeping its parts as files in a directory.
 *
 * **When to use**
 *
 * Use when the parts are to be read from disk, and no store of the program is stated.
 *
 * **Details**
 *
 * The keys are the `<id>/<index>` keys {@link layerKVStore} writes, and
 * `KeyValueStore.layerFileSystem` keeps each one as a single file.
 * A stated `directory` is created when the layer is built.
 * Where it is omitted, the directory is a temporary one, made with
 * `FileSystem.makeTempDirectoryScoped`, that the scope removes when the layer ends.
 * `capacity` bounds the memory holding decoded parts, as {@link layerKVStore} does.
 *
 * @see {@link layerKVStore} for the same cache over a store you provide.
 * @stability stable
 * @category layers
 */
export const layerFileSystem = (
  directory?: string,
  options?: {
    readonly capacity?: number | "unbounded";
  },
): Layer.Layer<
  Cache,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path | Scope.Scope
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const stated = directory ?? (yield* fs.makeTempDirectoryScoped({ prefix: "trajs-cache-" }));

    return layerKVStore(options).pipe(Layer.provide(KeyValueStore.layerFileSystem(stated)));
  }).pipe(Layer.unwrap);

/**
 * Creates a {@link Cache} holding every part of a trajectory in memory.
 *
 * **Details**
 *
 * Reading the source runs through to its end before the parts are all held.
 * `length` counts the parts held, and `at` reads one by a zero-based index.
 *
 * @see {@link Trajectory.TrajectoryFile} for the buffer.
 * @see {@link layerKVStore} for a cache keeping its parts in a store.
 * @stability stable
 * @category layers
 */
export const layerMemory: Layer.Layer<Cache> = Layer.effect(
  Cache,
  Effect.succeed({
    cache: <Id extends string, Config extends Config.AnyConfig, E, R>(
      trajectory: Trajectory.Trajectory<Id, Config, E, R>,
    ) =>
      trajectory.pipe(
        Stream.runCollect,
        Effect.map((parts): Trajectory.TrajectoryFile<Id, Config, never, never> => ({
          ...configOf<Config>(trajectory),
          id: trajectory.id,
          length: parts.length,
          at: (index) => Effect.succeed(Option.fromUndefinedOr(parts[index])),
        })),
      ),
  }),
);
