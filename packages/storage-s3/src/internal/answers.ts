/**
 * What a bucket answers about the object a store keeps under an id: how many bytes it holds, and
 * the bytes of a range of it.
 */

import { S3Service } from "@effect-aws/client-s3";
import * as ByteStore from "@trajs/utils/ByteStore";
import { Effect, Option } from "effect";

/** The status S3 answers a request for a range that begins at or past the end of an object with. */
const unservedStatus = 416;

/** What the SDK states of the answer a request failed with. */
interface Reported {
  readonly $metadata?: { readonly httpStatusCode?: number };
}

/** Whether `cause` is the answer to a range the object had ended before. */
const unserved = (cause: unknown): boolean =>
  // SAFETY: the SDK states the status it answered with on every failure it raises, and
  // `effect-aws` keeps those fields on the failure it makes of them.
  (cause as Reported | undefined)?.$metadata?.httpStatusCode === unservedStatus;

/** The bytes of the body the response of a read of `id` carries. */
const bodyOf = (
  id: string,
  held: { readonly Body?: unknown },
): Effect.Effect<Uint8Array, ByteStore.ByteStoreError> => {
  // SAFETY: the SDK adds `transformToByteArray` to the body of every streaming response, which the
  // type of the body states without.
  const body = held.Body as
    | { readonly transformToByteArray: () => Promise<Uint8Array> }
    | undefined;

  return body === undefined
    ? Effect.fail(ByteStore.ByteStoreError.from(id)("The response holds no body to read"))
    : Effect.tryPromise({
        try: () => body.transformToByteArray(),
        catch: ByteStore.ByteStoreError.from(id),
      });
};

/**
 * What a bucket answers about the objects a store keeps: how many bytes one holds, and the bytes
 * of a range of it.
 */
export interface Answers {
  /** The number of bytes the bucket keeps under `id`, as none where it keeps nothing there. */
  readonly lengthOf: (
    bucket: string,
    id: string,
  ) => Effect.Effect<Option.Option<bigint>, ByteStore.ByteStoreError>;
  /**
   * The bytes of the range of `id` holding `size` bytes from `offset` on, as none where the
   * object had ended before the range began.
   */
  readonly bytesAt: (
    bucket: string,
    id: string,
    offset: bigint,
    size: number,
  ) => Effect.Effect<Option.Option<Uint8Array>, ByteStore.ByteStoreError>;
}

/**
 * What a bucket answers about the objects a store keeps, built once where the store is.
 */
export const answers: Effect.Effect<Answers, never, S3Service> = Effect.map(S3Service, (s3) => ({
  lengthOf: (bucket, id) =>
    s3.headObject({ Bucket: bucket, Key: id }).pipe(
      Effect.map(({ ContentLength }) =>
        Option.fromUndefinedOr(ContentLength).pipe(Option.map(BigInt)),
      ),
      // A key the bucket keeps nothing under is an id that holds nothing, not a failed head.
      Effect.catchTag("NotFound", () => Effect.succeed(Option.none<bigint>())),
      Effect.mapError(ByteStore.ByteStoreError.from(id)),
    ),
  bytesAt: (bucket, id, offset, size) =>
    s3
      .getObject({
        Bucket: bucket,
        Key: id,
        Range: `bytes=${offset}-${offset + BigInt(size) - 1n}`,
      })
      .pipe(
        Effect.flatMap((held) => bodyOf(id, held)),
        Effect.map(Option.some),
        // A range the object had ended before is the end of the sequence, not a failed read.
        Effect.catchIf(unserved, () => Effect.succeed(Option.none<Uint8Array>())),
        Effect.mapError(ByteStore.ByteStoreError.from(id)),
      ),
}));
