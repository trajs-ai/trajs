/**
 * A store of byte sequences a program keeps between readings.
 *
 * What holds them is the key/value store of `effect/persistence`, a directory of files, or a
 * bucket, so where the bytes live is the store layer's to say.
 * A store over a key/value store keeps a sequence as the chunks it is cut into rather than as one
 * value.
 * A read reaches only the part it asks for, so a sequence is read without holding it whole.
 *
 * This package states a store in memory ({@link layerMemory}), one in a directory of the file
 * system ({@link layerFileSystem}), one in a bucket ({@link layerS3}), and one over a key/value
 * store a program holds ({@link layerKVStore}).
 *
 * @stability stable
 */

import type { GetObjectOutput, S3Client } from "@aws-sdk/client-s3";
import {
  ByteSize,
  Context,
  Data,
  Effect,
  FileSystem,
  Formatter,
  Layer,
  Option,
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
 * Use where a store is built ({@link layerMemory}, {@link layerFileSystem}, {@link layerKVStore})
 * and how it cuts a sequence matters, such as the quota of a store of a limited size.
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
   * What a read reaches is read out of the store and joined, and none of the rest of the sequence
   * is read.
   * An id that holds nothing fails as a {@link ByteStoreError}.
   *
   * The store as it holds when this runs is what the view serves, so a sequence written again
   * meanwhile is read as it was.
   * What the view serves that the store no longer holds fails the read rather than serving fewer
   * bytes.
   */
  readonly read: (id: string) => Effect.Effect<Byte<ByteStoreError>, ByteStoreError>;

  /**
   * The sink a sequence is written into `id` through.
   *
   * What is written is cut into chunks as it arrives, and a chunk is kept once it has arrived
   * whole.
   * A store that cuts a sequence keeps it as it is produced rather than once it has ended.
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
   * Drops what `id` holds.
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

/**
 * The bucket the store {@link layerS3} provides keeps its sequences in.
 *
 * **When to use**
 *
 * Use where a program builds the store, to name the bucket its bytes are kept in.
 *
 * **Details**
 *
 * `bucket` names the bucket, which the layer neither creates nor removes.
 * One id is one object of the bucket, named after the id.
 *
 * @see {@link ByteStore} for what the store serves.
 * @stability stable
 * @category models
 */
export interface S3Options {
  readonly bucket: string;
}

// The name an SDK error reports, where it reports one.
const nameOf = (cause: unknown): string | undefined => {
  if (!Predicate.isObject(cause) || !Predicate.hasProperty(cause, "name")) return undefined;

  return Predicate.isString(cause.name) ? cause.name : undefined;
};

// A bucket names a key it holds nothing under as missing, which is not a failure of the store.
const absent = (cause: unknown): boolean => {
  const name = nameOf(cause);

  return name === "NoSuchKey" || name === "NotFound";
};

// A range that begins at or past the end of an object holds no bytes, which is not a failure.
const unserved = (cause: unknown): boolean => nameOf(cause) === "InvalidRange";

// The bytes of the body a response holds.
const bodyOf = (id: string, held: GetObjectOutput): Effect.Effect<Uint8Array, ByteStoreError> => {
  const failed = ByteStoreError.from(id);

  // SAFETY: the SDK adds `transformToByteArray` to the body of every streaming response, which
  // the type of the body states without.
  const body = held.Body as
    | { readonly transformToByteArray: () => Promise<Uint8Array> }
    | undefined;

  return body === undefined
    ? Effect.fail(failed("The response holds no body to read"))
    : Effect.tryPromise({ try: () => body.transformToByteArray(), catch: failed });
};

// The bytes of the parts as one buffer.
const joined = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const whole = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;

  for (const part of parts) {
    whole.set(part, at);
    at += part.length;
  }

  return whole;
};

/**
 * A store that keeps a sequence in a bucket, one object per id.
 *
 * **When to use**
 *
 * Use to keep the bytes of a trajectory in a bucket, so what a reader reads is not held by the
 * machine that wrote it.
 *
 * **Details**
 *
 * `client` is the {@link S3Client} every request is sent through, and `options` names the bucket
 * ({@link S3Options}), which the layer neither creates nor removes.
 *
 * One id is one object, named after the id, and a read fetches the part it asks for with a range
 * request rather than the whole sequence.
 * A write drops what the id held, and puts the object once the sequence has ended.
 *
 * **Gotchas**
 *
 * A write holds the sequence in memory until it ends, since one object is put from one buffer.
 * A write that ends before the sequence does leaves the id holding nothing.
 *
 * @see {@link ByteStore} for what the store serves.
 * @see {@link layerFileSystem} for the same sequences kept in a directory.
 * @see {@link layerKVStore} for a sequence kept as the chunks it is cut into.
 * @stability stable
 * @category layers
 */
export const layerS3 = (client: S3Client, options: S3Options): Layer.Layer<ByteStore> =>
  Layer.effect(
    ByteStore,
    Effect.gen(function* () {
      const sdk = yield* Effect.promise(() => import("@aws-sdk/client-s3"));

      const { bucket } = options;
      const failed = ByteStoreError.from;

      // Whether the bucket holds an object under `id`.
      const holds = (id: string): Effect.Effect<boolean, ByteStoreError> =>
        Effect.tryPromise({
          try: () => client.send(new sdk.HeadObjectCommand({ Bucket: bucket, Key: id })),
          catch: (cause) => cause,
        }).pipe(
          Effect.as(true),
          // A key the bucket holds nothing under is an id that holds nothing, not a failure.
          Effect.catch((cause) =>
            absent(cause) ? Effect.succeed(false) : Effect.fail(failed(id)(cause)),
          ),
        );

      // How many bytes the object `id` is kept as holds.
      const lengthOf = (id: string): Effect.Effect<bigint, ByteStoreError> =>
        Effect.tryPromise({
          try: () => client.send(new sdk.HeadObjectCommand({ Bucket: bucket, Key: id })),
          catch: failed(id),
        }).pipe(
          Effect.flatMap((info) =>
            info.ContentLength === undefined
              ? Effect.fail(failed(id)("The object states no length"))
              : Effect.succeed(BigInt(info.ContentLength)),
          ),
        );

      // Keeps `bytes` as the object `id`, in place of what the bucket held under it.
      const put = (id: string, bytes: Uint8Array): Effect.Effect<void, ByteStoreError> =>
        Effect.tryPromise({
          try: () =>
            client.send(new sdk.PutObjectCommand({ Bucket: bucket, Key: id, Body: bytes })),
          catch: failed(id),
        }).pipe(Effect.asVoid);

      // Drops the object `id`, which holds nothing once the bucket has dropped it.
      const drop = (id: string): Effect.Effect<void, ByteStoreError> =>
        Effect.tryPromise({
          try: () => client.send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: id })),
          catch: failed(id),
        }).pipe(Effect.asVoid);

      // The object `id` is kept as, served as a sequence read at random.
      const sequence = (id: string): Byte<ByteStoreError> =>
        make({
          length: lengthOf(id),
          read: (buffer, options) =>
            Effect.gen(function* () {
              const offset = options?.offset ?? 0n;
              const size = Math.min(options?.size ?? buffer.length, buffer.length);

              // A read that asks for nothing serves nothing, which is where the sequence ended.
              if (size <= 0) return 0;

              const held = yield* Effect.tryPromise({
                try: () =>
                  client.send(
                    new sdk.GetObjectCommand({
                      Bucket: bucket,
                      Key: id,
                      Range: `bytes=${offset}-${offset + BigInt(size) - 1n}`,
                    }),
                  ),
                catch: (cause) => cause,
              }).pipe(
                Effect.map(Option.some),
                // A range the object ends before is no bytes, which is where the sequence ends.
                Effect.catch((cause) =>
                  unserved(cause) ? Effect.succeed(Option.none()) : Effect.fail(failed(id)(cause)),
                ),
              );

              if (Option.isNone(held)) return 0;

              const taken = yield* bodyOf(id, held.value);

              buffer.set(taken);

              return taken.length;
            }),
        });

      return ByteStore.of({
        read: (id) =>
          holds(id).pipe(
            Effect.flatMap((exists) =>
              exists
                ? Effect.succeed(sequence(id))
                : Effect.fail(ByteStoreError.from(id)("No sequence is kept under the id")),
            ),
          ),
        write: (id, options) =>
          Effect.gen(function* () {
            const exists = yield* holds(id);

            if (exists && options?.overwrite === false) {
              return yield* Effect.fail(
                ByteStoreError.from(id)("A sequence is already kept under the id"),
              );
            }

            // What the id held is dropped before the first byte is kept, so a write that ends
            // before the sequence does leaves the id holding nothing.
            yield* drop(id);

            const parts: Uint8Array[] = [];

            return Sink.forEach((input: Uint8Array) =>
              Effect.sync(() => {
                parts.push(input);
              }),
            ).pipe(Sink.mapEffectEnd((end) => put(id, joined(parts)).pipe(Effect.map(() => end))));
          }).pipe(Sink.unwrap),
        remove: (id) => drop(id),
        has: (id) => holds(id),
      });
    }),
  );
