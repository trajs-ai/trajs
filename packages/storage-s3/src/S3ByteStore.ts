/**
 * The bytes of a sequence in a bucket of S3.
 *
 * {@link layer} provides the `ByteStore` of `@trajs/utils` over a bucket, through the
 * `S3Service` of `@effect-aws/client-s3`.
 *
 * @stability stable
 */

import { S3Service } from "@effect-aws/client-s3";
import { type Byte, make } from "@trajs/utils/Byte";
import * as ByteStore from "@trajs/utils/ByteStore";
import { Effect, Layer, Option, Sink } from "effect";

import { answers } from "#/internal/answers.ts";
import { sinks } from "#/internal/upload.ts";

/**
 * The bucket the store {@link layer} provides keeps its sequences in.
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
 * @see {@link layer} for the store this names the bucket of.
 * @stability stable
 * @category models
 */
export interface Options {
  readonly bucket: string;
}

/**
 * The store of bytes a bucket keeps, one object per id.
 *
 * **When to use**
 *
 * Use to keep the bytes of a trajectory in a bucket, so what a reader reads is not held by the
 * machine that wrote it.
 *
 * **Details**
 *
 * `options` names the bucket ({@link Options}), which the layer neither creates nor removes.
 * Every request is sent through the `S3Service` a program provides, such as the one
 * `S3Service.defaultLayer` builds.
 *
 * One id is one object, named after the id, and a read fetches the part it asks for with a range
 * request rather than the whole sequence.
 * A write drops what the id held, and keeps the sequence as it arrives: as the one object it fits
 * where it is shorter than a part of a multipart upload, and as the parts of an upload otherwise.
 *
 * **Gotchas**
 *
 * A write that fails or is interrupted drops the parts of the upload it opened,
 * which leaves the id holding nothing.
 * Parts left by a process that dies mid-write stay in the bucket until a lifecycle rule expires
 * them.
 *
 * @see {@link ByteStore.layerFileSystem} for the same sequences kept in a directory.
 * @see {@link ByteStore.layerKVStore} for a sequence kept as the chunks it is cut into.
 * @stability stable
 * @category layers
 */
export const layer = (options: Options): Layer.Layer<ByteStore.ByteStore, never, S3Service> =>
  Layer.effect(
    ByteStore.ByteStore,
    Effect.gen(function* () {
      const s3 = yield* S3Service;
      const { bytesAt, lengthOf } = yield* answers;
      const { writeSink } = yield* sinks;

      const { bucket } = options;
      const failed = ByteStore.ByteStoreError.from;

      // What the bucket keeps under `id`, as the number of bytes it holds.
      const held = (id: string): Effect.Effect<Option.Option<bigint>, ByteStore.ByteStoreError> =>
        lengthOf(bucket, id);

      const has = (id: string): Effect.Effect<boolean, ByteStore.ByteStoreError> =>
        held(id).pipe(Effect.map(Option.isSome));

      const drop = (id: string): Effect.Effect<void, ByteStore.ByteStoreError> =>
        s3
          .deleteObject({ Bucket: bucket, Key: id })
          .pipe(Effect.mapError(failed(id)), Effect.asVoid);

      // The object `id` is kept as, served as a sequence read at random.
      const sequence = (id: string, length: bigint): Byte<ByteStore.ByteStoreError> =>
        make({
          length: Effect.succeed(length),
          read: (buffer, options) =>
            Effect.gen(function* () {
              const offset = options?.offset ?? 0n;
              const size = Math.min(options?.size ?? buffer.length, buffer.length);

              // A read that asks for nothing serves nothing, which is where the sequence ended.
              if (size <= 0) return 0;

              const taken = yield* bytesAt(bucket, id, offset, size);

              return Option.match(taken, {
                onNone: () => 0,
                onSome: (served) => {
                  buffer.set(served);

                  return served.length;
                },
              });
            }),
        });

      return ByteStore.ByteStore.of({
        read: (id) =>
          held(id).pipe(
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.fail(failed(id)("No sequence is kept under the id")),
                onSome: (length) => Effect.succeed(sequence(id, length)),
              }),
            ),
          ),
        write: (id, options) =>
          Effect.gen(function* () {
            const exists = yield* has(id);

            if (exists && options?.overwrite === false) {
              return yield* Effect.fail(failed(id)("A sequence is already kept under the id"));
            }

            // What the id held is dropped before the first byte is kept, so a write that ends
            // before the sequence does leaves the id holding nothing.
            yield* drop(id);

            // What the sink keeps between the chunks is dropped with the scope of the write.
            return yield* writeSink(bucket, id);
          }).pipe(
            // The sink is built in the scope of the write, which an upload it never completed
            // is dropped with.
            Sink.unwrap,
          ),
        remove: (id) => drop(id),
        has,
      });
    }),
  );
