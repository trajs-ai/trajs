/**
 * A store of byte sequences a program keeps between readings.
 *
 * What holds them is the key/value store of `effect/persistence` or a directory of files, so where
 * the bytes live is the store layer's to say.
 * A store over a key/value store keeps a sequence as the chunks it is cut into rather than as one
 * value.
 * A read reaches only the part it asks for, so a sequence too large to hold is still written and
 * read.
 *
 * This package states a store in memory ({@link layerMemory}), one in a directory of the file
 * system ({@link layerFileSystem}), one in a bucket ({@link layerS3}), and one over a key/value
 * store a program holds ({@link layerKVStore}).
 *
 * @stability stable
 */

import type { S3Client } from "@aws-sdk/client-s3";
import {
  ByteSize,
  Context,
  Data,
  Effect,
  FileSystem,
  Formatter,
  Layer,
  Path,
  Predicate,
  Sink,
} from "effect";
import { KeyValueStore } from "effect/persistence";
import type { PlatformError } from "effect/PlatformError";
import type { Scope } from "effect/Scope";

import { type Byte, make, makeFromFile } from "#/Byte.ts";

/**
 * How the bytes written to a store are cut into chunks.
 *
 * **When to use**
 *
 * Use where a store is built ({@link layerMemory}, {@link layerFileSystem}, {@link layerKVStore},
 * {@link layerS3}) and how it cuts a sequence matters, such as the quota of a store of a limited
 * size.
 *
 * **Details**
 *
 * - `chunkSize` is how many bytes of a sequence are kept under one key, and defaults to
 *   {@link defaultChunkSize}.
 *
 * The size states how a sequence is cut as it is written rather than how it is read.
 * The size a sequence was written with is kept beside it, so a store built with one size reads a
 * sequence another wrote.
 *
 * @see {@link defaultChunkSize} for the size a store cuts with where none is stated.
 * @stability stable
 * @category models
 */
export interface Options {
  readonly chunkSize?: number;
}

/**
 * How many bytes of a sequence are kept under one key where a store states no size.
 *
 * **When to use**
 *
 * Use where a store resolves the option it was built with ({@link Options}), so what a program
 * stating nothing gets is stated once.
 *
 * **Details**
 *
 * It is 64 KiB, the size {@link Byte.stream} reads a sequence in by default.
 * A store keeping a sequence in chunks of it serves the chunks a reader asks for, without cutting
 * them again.
 *
 * @see {@link Options} for where the size is stated.
 * @stability stable
 * @category constants
 */
export const defaultChunkSize = 64 * 1024;

/**
 * A store of byte sequences, read back as a {@link Byte}.
 *
 * **When to use**
 *
 * Use to keep the bytes of a trajectory where reading them again is cheaper than reading them from
 * a storage, such as the frame of a trajectory.
 * Use as well to write them without holding the sequence whole.
 *
 * **Details**
 *
 * - `read` serves the bytes kept under an id as a {@link Byte}, and an id that holds nothing fails
 *   as a {@link ByteStoreError}.
 * - `write` gives the sink a sequence is written through, so its bytes are cut and kept as they are
 *   produced.
 * - `remove` drops what an id holds, and removes nothing where the id holds nothing.
 * - `has` says whether an id holds a sequence.
 *
 * Nothing but an id is asked of a caller.
 * How a sequence is cut is the store's to say ({@link Options}), and the keys its chunks are kept
 * under are read off the id.
 *
 * **Example** (Keeping a sequence of bytes and reading part of it back)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 *
 * import { ByteStore } from "@trajs/utils"
 *
 * const program = Effect.gen(function* () {
 *   const store = yield* ByteStore.ByteStore
 *
 *   // Four bytes to a chunk, so the sequence is kept in two of them.
 *   yield* Stream.make(new TextEncoder().encode("trajs")).pipe(Stream.run(store.write("a")))
 *
 *   return yield* (yield* store.read("a")).readAlloc({ offset: 2n })
 * })
 *
 * const bytes = await Effect.runPromise(
 *   program.pipe(Effect.provide(ByteStore.layerMemory({ chunkSize: 4 }))),
 * )
 *
 * new TextDecoder().decode(bytes) // => "ajs"
 * ```
 *
 * @see {@link layerMemory} for the store this service is provided as.
 * @stability stable
 * @category services
 */
export interface ByteStore {
  /**
   * Serves the bytes kept under `id` as a {@link Byte}.
   *
   * What a read reaches is read out of the store and joined, and none of the other chunks are read.
   * An id that holds nothing fails as a {@link ByteStoreError}.
   *
   * The record an id holds when this runs is what the view serves, so a sequence written again
   * meanwhile is read as it was.
   * A chunk the view states that the store no longer holds fails the read rather than serving fewer
   * bytes.
   */
  readonly read: (id: string) => Effect.Effect<Byte<ByteStoreError>, ByteStoreError>;

  /**
   * The sink a sequence is written into `id` through.
   *
   * What is written is cut into chunks as it arrives, and a chunk is kept once it has arrived
   * whole.
   * A sequence is kept as it is produced, not once it has ended.
   * Nothing is held open between chunks, so the sink needs no scope of its own.
   *
   * What the id held is dropped before the first byte is written.
   * A write that ends before the sequence does leaves the id holding nothing.
   */
  readonly write: (
    id: string,
    options?: {
      /**
       * Whether a sequence already held under the id is written over.
       */
      readonly overwrite?: boolean;
    },
  ) => Sink.Sink<void, Uint8Array, never, ByteStoreError>;

  /**
   * Drops the chunks kept under `id` and the record naming them.
   */
  readonly remove: (id: string) => Effect.Effect<void, ByteStoreError>;

  /**
   * Says whether `id` holds a sequence.
   */
  readonly has: (id: string) => Effect.Effect<boolean, ByteStoreError>;
}

/**
 * The service a store of bytes is provided through.
 *
 * **When to use**
 *
 * Use to require a store of a program, and {@link layerMemory}, {@link layerFileSystem},
 * {@link layerKVStore} or {@link make} to provide it.
 *
 * **Details**
 *
 * What holds the bytes is a store of `effect/persistence` rather than a place of this package's.
 * A store is provided at the composition root of a program, and the bytes are reached through the
 * service alone.
 * Which store that is, such as memory or a file system, is the layer's to say.
 *
 * @see {@link ByteStore} for what the service gives.
 * @stability stable
 * @category tags
 */
export const ByteStore: Context.Service<ByteStore, ByteStore> = Context.Service<
  ByteStore,
  ByteStore
>()("trajs/utils/ByteStore");

/**
 * A failed read or write of a store, or an id that holds no sequence.
 *
 * **When to use**
 *
 * Use to tell the failure of a store apart from the failure of the bytes it was asked for.
 * A store that refused, that was cut short, or that holds nothing where an id was named fails as
 * this error.
 * Bytes that do not hold what the reader is reading fail as the reader's own error.
 *
 * **Details**
 *
 * `id` names the sequence the store was asked about, the one read or the one written.
 * `cause` is what the store failed with, as it reported it, such as the failure of the key/value
 * store underneath.
 *
 * @see {@link ByteStore} for what a sequence is read and written through.
 * @stability stable
 * @category errors
 */
export class ByteStoreError extends Data.TaggedError("ByteStoreError")<{
  id: string;
  cause: unknown;
}> {
  /**
   * Creates the failure of a store over `id` from the cause it failed with.
   */
  static readonly from = (id: string) => (cause: unknown) => new ByteStoreError({ id, cause });

  override get message(): string {
    return `Failed to read or write '${this.id}': ${Formatter.format(this.cause)}`;
  }
}

export const layerKVStore = (
  options?: Options,
): Layer.Layer<ByteStore, never, KeyValueStore.KeyValueStore> =>
  Layer.effect(
    ByteStore,
    Effect.gen(function* () {
      const kvstore = yield* KeyValueStore.KeyValueStore;

      throw new Error("not implemented");
    }),
  );

export const layerMemory = (options?: Options): Layer.Layer<ByteStore> =>
  layerKVStore(options).pipe(Layer.provide(KeyValueStore.layerMemory));

/**
 * A store that keeps each sequence in a file of a directory.
 *
 * **When to use**
 *
 * Use to keep the bytes of a trajectory between runs in a directory, with no key/value store
 * behind it.
 *
 * **Details**
 *
 * One id is one file, named after the id, so a sequence is read at random through
 * {@link Byte.read}.
 * `dir` names the directory, which the layer creates.
 * Where `dir` is omitted, the directory is a temporary one, made with
 * `FileSystem.makeTempDirectoryScoped`, that the scope removes when the layer ends.
 *
 * A directory stated alone is `dir`, so `layerFileSystem("parts")` and
 * `layerFileSystem({ dir: "parts" })` build the same layer.
 *
 * A write under an id that already holds a sequence drops it before the first byte is written,
 * unless `overwrite` is stated `false`, which fails the write instead.
 * The sequence takes the place of the file once it is whole, so a write that ends early leaves
 * nothing under the id.
 *
 * @see {@link ByteStore} for what the store serves.
 * @see {@link layerKVStore} for the store kept in a key/value store.
 * @stability stable
 * @category layers
 */
export const layerFileSystem = (
  options: string | { readonly dir?: string } = {},
): Layer.Layer<ByteStore, PlatformError, FileSystem.FileSystem | Path.Path | Scope> =>
  Layer.effect(
    ByteStore,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const named = Predicate.isString(options) ? options : options.dir;
      // A store that names no directory is kept in a temporary one, dropped with the scope of the
      // layer.
      const directory = named ?? (yield* fs.makeTempDirectoryScoped({ prefix: "trajs" }));

      yield* fs.makeDirectory(directory, { recursive: true });

      // The escapes leave the name of an id as one path segment of the directory, so every id is a
      // file of its own.
      const file = (id: string): string =>
        path.join(directory, encodeURIComponent(id).replaceAll(".", "%2E"));

      const bytes = (id: string): Byte<ByteStoreError> =>
        make({
          length: fs.stat(file(id)).pipe(
            Effect.map((info) => ByteSize.toBigInt(info.size)),
            Effect.mapError(ByteStoreError.from(id)),
          ),
          read: (buffer, options) =>
            // The handle is opened for the read alone, so a sequence holds nothing open between
            // reads.
            fs.open(file(id), { flag: "r" }).pipe(
              Effect.flatMap((opened) => makeFromFile(opened).read(buffer, options)),
              Effect.mapError(ByteStoreError.from(id)),
              Effect.scoped,
            ),
        });

      return ByteStore.of({
        read: (id) =>
          fs.exists(file(id)).pipe(
            Effect.mapError(ByteStoreError.from(id)),
            Effect.flatMap((held) =>
              held
                ? Effect.succeed(bytes(id))
                : Effect.fail(ByteStoreError.from(id)("No sequence is kept under the id")),
            ),
          ),
        write: (id, options) =>
          Effect.gen(function* () {
            const target = file(id);
            const held = yield* fs.exists(target).pipe(Effect.mapError(ByteStoreError.from(id)));

            if (held && options?.overwrite === false) {
              return yield* Effect.fail(
                ByteStoreError.from(id)("A sequence is already kept under the id"),
              );
            }

            // The sequence is written beside the file and takes its place once it is whole, so a
            // write that ends before the sequence does leaves nothing under the id.
            const written = yield* fs
              .makeTempFileScoped({ directory })
              .pipe(Effect.mapError(ByteStoreError.from(id)));

            yield* fs
              .remove(target, { force: true })
              .pipe(Effect.mapError(ByteStoreError.from(id)));

            return fs.sink(written).pipe(
              Sink.mapEffectEnd((end) =>
                fs.rename(written, target).pipe(
                  Effect.mapError(ByteStoreError.from(id)),
                  Effect.map(() => end),
                ),
              ),
              Sink.mapError(ByteStoreError.from(id)),
            );
          }).pipe(Sink.unwrap),
        remove: (id) =>
          fs.remove(file(id), { force: true }).pipe(Effect.mapError(ByteStoreError.from(id))),
        has: (id) => fs.exists(file(id)).pipe(Effect.mapError(ByteStoreError.from(id))),
      });
    }),
  );

export interface S3Options extends Options {
  readonly bucket: string;
}

export const layerS3 = (client: S3Client, options: S3Options): Layer.Layer<ByteStore> =>
  Layer.effect(
    ByteStore,
    Effect.gen(function* () {
      const sdk = yield* Effect.promise(() => import("@aws-sdk/client-s3"));

      throw new Error("not implemented");
    }),
  );
