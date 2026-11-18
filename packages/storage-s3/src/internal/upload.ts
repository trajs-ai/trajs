/**
 * The parts a sequence is sent to a bucket as, once it no longer fits one put.
 */

import type { CompletedPart } from "@aws-sdk/client-s3";
import type { S3Service } from "@effect-aws/client-s3";
import * as ByteStore from "@trajs/utils/ByteStore";
import { Effect } from "effect";

/**
 * The bytes a part is filled to before it is sent. The bucket serves no upload whose parts are
 * smaller than this, the last one aside, so a sequence that never fills one is put as one object
 * instead.
 */
const partSize = 5 * 1024 * 1024;

/** The chunks a sequence arrived as, as the one buffer a part or an object is sent from. */
const joined = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const whole = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;

  for (const part of parts) {
    whole.set(part, at);
    at += part.length;
  }

  return whole;
};

/** A sequence sent to the bucket as the parts it fills. */
export interface Upload {
  /** Adds a chunk to the part being filled, and sends the part once it is full. */
  readonly push: (bytes: Uint8Array) => Effect.Effect<void, ByteStore.ByteStoreError>;
  /** Sends the part being filled, and keeps `id` as the parts sent. */
  readonly finish: () => Effect.Effect<void, ByteStore.ByteStoreError>;
  /** Drops the parts of the upload, which is never completed. */
  readonly abandon: () => Effect.Effect<void>;
}

/**
 * The upload `id` is kept as, through the `S3Service` a program provides, over `bucket`.
 *
 * The upload is opened once a part is full, so a sequence shorter than one part is put as a single
 * object rather than started and completed as an upload of one part.
 */
export const makeUpload = (s3: S3Service.Type, bucket: string, id: string): Upload => {
  const failed = ByteStore.ByteStoreError.from(id);

  const parts: CompletedPart[] = [];
  const pending: Uint8Array[] = [];
  let pendingLength = 0;
  let uploadId: string | undefined;

  // Opens the upload the parts are sent under.
  const open = (): Effect.Effect<string, ByteStore.ByteStoreError> =>
    s3.createMultipartUpload({ Bucket: bucket, Key: id }).pipe(
      Effect.mapError(failed),
      Effect.flatMap((created) =>
        created.UploadId === undefined
          ? Effect.fail(failed("The bucket states no upload to send the parts under"))
          : Effect.succeed(created.UploadId),
      ),
    );

  // Sends `bytes` as the part after the ones the upload holds.
  const send = (bytes: Uint8Array): Effect.Effect<void, ByteStore.ByteStoreError> =>
    Effect.gen(function* () {
      if (uploadId === undefined) {
        uploadId = yield* open();
      }

      const partNumber = parts.length + 1;

      const taken = yield* s3
        .uploadPart({
          Bucket: bucket,
          Key: id,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: bytes,
        })
        .pipe(Effect.mapError(failed));

      if (taken.ETag === undefined) {
        return yield* Effect.fail(failed("The bucket states no ETag of the part it took"));
      }

      parts.push({ ETag: taken.ETag, PartNumber: partNumber });
    });

  // Sends what the part being filled holds, so the next part starts empty.
  const flush = (): Effect.Effect<void, ByteStore.ByteStoreError> =>
    Effect.gen(function* () {
      if (pendingLength === 0) return;

      const bytes = joined(pending);

      pending.length = 0;
      pendingLength = 0;

      yield* send(bytes);
    });

  const push = (bytes: Uint8Array): Effect.Effect<void, ByteStore.ByteStoreError> =>
    Effect.gen(function* () {
      pending.push(bytes);
      pendingLength += bytes.length;

      if (pendingLength < partSize) return;

      yield* flush();
    });

  const finish = (): Effect.Effect<void, ByteStore.ByteStoreError> =>
    Effect.gen(function* () {
      const opened = uploadId;

      // A sequence that never filled a part is kept as the one object it fits.
      if (opened === undefined) {
        const bytes = joined(pending);

        pending.length = 0;
        pendingLength = 0;

        yield* s3
          .putObject({ Bucket: bucket, Key: id, Body: bytes })
          .pipe(Effect.mapError(failed), Effect.asVoid);

        return;
      }

      yield* flush();

      yield* s3
        .completeMultipartUpload({
          Bucket: bucket,
          Key: id,
          UploadId: opened,
          MultipartUpload: { Parts: parts },
        })
        .pipe(Effect.mapError(failed), Effect.asVoid);
    });

  // The bucket serves nothing of an upload that is never completed, but it holds its parts until
  // they are dropped.
  const abandon = (): Effect.Effect<void> => {
    const opened = uploadId;

    return opened === undefined
      ? Effect.void
      : s3
          .abortMultipartUpload({ Bucket: bucket, Key: id, UploadId: opened })
          .pipe(Effect.ignoreCause);
  };

  return { push, finish, abandon };
};
