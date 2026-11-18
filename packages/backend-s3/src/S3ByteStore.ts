/**
 * The bytes of a sequence in a bucket of S3.
 *
 * {@link layer} provides the `ByteStore` of `@trajs/utils` over a bucket, through the
 * `S3Service` of `@effect-aws/client-s3`.
 *
 * @stability stable
 */

import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { type SdkError, S3Service } from "@effect-aws/client-s3";
import { type Byte, make } from "@trajs/utils/Byte";
import * as ByteStore from "@trajs/utils/ByteStore";
import { Effect, Layer, Option, Sink } from "effect";

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

/** The status S3 answers a range that begins at or past the end of an object with. */
const unservedStatus = 416;

/** What the SDK states of the answer a request failed with. */
interface Reported {
  readonly $metadata?: { readonly httpStatusCode?: number };
}

// A range that begins at or past the end of an object serves no bytes, which is not a failure of
// the store.
const unserved = (cause: SdkError): boolean =>
  // SAFETY: the SDK states the status it answered with on every failure it raises, and
  // `effect-aws` keeps those fields on the failure it makes of them.
  (cause as Reported).$metadata?.httpStatusCode === unservedStatus;

const bodyOf = (
  id: string,
  held: GetObjectCommandOutput,
): Effect.Effect<Uint8Array, ByteStore.ByteStoreError> => {
  const failed = ByteStore.ByteStoreError.from(id);

  // SAFETY: the SDK adds `transformToByteArray` to the body of every streaming response, which
  // the type of the body states without.
  const body = held.Body as
    | { readonly transformToByteArray: () => Promise<Uint8Array> }
    | undefined;

  return body === undefined
    ? Effect.fail(failed("The response holds no body to read"))
    : Effect.tryPromise({ try: () => body.transformToByteArray(), catch: failed });
};

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
 * A write drops what the id held, and puts the object once the sequence has ended.
 *
 * **Gotchas**
 *
 * A write holds the sequence in memory until it ends, since one object is put from one buffer.
 * A write that ends before the sequence does leaves the id holding nothing.
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

      const { bucket } = options;
      const failed = ByteStore.ByteStoreError.from;

      // Whether the bucket holds an object under `id`.
      const holds = (id: string): Effect.Effect<boolean, ByteStore.ByteStoreError> =>
        s3.headObject({ Bucket: bucket, Key: id }).pipe(
          Effect.as(true),
          // A key the bucket holds nothing under is an id that holds nothing, not a failure.
          Effect.catchTag("NotFound", () => Effect.succeed(false)),
          Effect.mapError(failed(id)),
        );

      // How many bytes the object `id` is kept as holds.
      const lengthOf = (id: string): Effect.Effect<bigint, ByteStore.ByteStoreError> =>
        s3.headObject({ Bucket: bucket, Key: id }).pipe(
          Effect.mapError(failed(id)),
          Effect.flatMap((info) =>
            info.ContentLength === undefined
              ? Effect.fail(failed(id)("The object states no length"))
              : Effect.succeed(BigInt(info.ContentLength)),
          ),
        );

      // Keeps `bytes` as the object `id`, in place of what the bucket held under it.
      const put = (id: string, bytes: Uint8Array): Effect.Effect<void, ByteStore.ByteStoreError> =>
        s3
          .putObject({ Bucket: bucket, Key: id, Body: bytes })
          .pipe(Effect.mapError(failed(id)), Effect.asVoid);

      // Drops the object `id`.
      const drop = (id: string): Effect.Effect<void, ByteStore.ByteStoreError> =>
        s3
          .deleteObject({ Bucket: bucket, Key: id })
          .pipe(Effect.mapError(failed(id)), Effect.asVoid);

      // The object `id` is kept as, served as a sequence read at random.
      const sequence = (id: string): Byte<ByteStore.ByteStoreError> =>
        make({
          length: lengthOf(id),
          read: (buffer, options) =>
            Effect.gen(function* () {
              const offset = options?.offset ?? 0n;
              const size = Math.min(options?.size ?? buffer.length, buffer.length);

              // A read that asks for nothing serves nothing, which is where the sequence ended.
              if (size <= 0) return 0;

              const held = yield* s3
                .getObject({
                  Bucket: bucket,
                  Key: id,
                  Range: `bytes=${offset}-${offset + BigInt(size) - 1n}`,
                })
                .pipe(
                  Effect.map((response) => Option.some(response)),
                  Effect.catchTag("SdkError", (cause) =>
                    unserved(cause)
                      ? Effect.succeed(Option.none<GetObjectCommandOutput>())
                      : Effect.fail(cause),
                  ),
                  Effect.mapError(failed(id)),
                );

              if (Option.isNone(held)) return 0;

              const taken = yield* bodyOf(id, held.value);

              buffer.set(taken);

              return taken.length;
            }),
        });

      return ByteStore.ByteStore.of({
        read: (id) =>
          holds(id).pipe(
            Effect.flatMap((exists) =>
              exists
                ? Effect.succeed(sequence(id))
                : Effect.fail(failed(id)("No sequence is kept under the id")),
            ),
          ),
        write: (id, options) =>
          Effect.gen(function* () {
            const exists = yield* holds(id);

            if (exists && options?.overwrite === false) {
              return yield* Effect.fail(failed(id)("A sequence is already kept under the id"));
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
