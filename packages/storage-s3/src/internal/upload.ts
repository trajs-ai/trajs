/**
 * The parts a sequence is sent to a bucket as, once it no longer fits one put.
 */

import type { CompletedPart } from "@aws-sdk/client-s3";
import { S3Service } from "@effect-aws/client-s3";
import { Byte } from "@trajs/utils";
import * as ByteStore from "@trajs/utils/ByteStore";
import { Effect, Exit, Option, Sink } from "effect";
import { Scope } from "effect/Scope";

/**
 * The bytes a part is filled to before it is sent. The bucket serves no upload whose parts are
 * smaller than this, the last one aside, so a sequence that never fills one is put as one object
 * instead.
 */
const partSize = 5 * 1024 * 1024;

/** How many bytes `chunks` holds. */
const bytesIn = (chunks: ReadonlyArray<Uint8Array>): number =>
  chunks.reduce((total, chunk) => total + chunk.length, 0);

/** The upload the parts are sent under, and the parts the bucket has taken of it. */
interface Upload {
  readonly id: string;
  readonly parts: ReadonlyArray<CompletedPart>;
}

/** What a write holds between the chunks that arrive. */
interface Held {
  /** The upload the parts are sent under, once a part has filled. */
  readonly upload: Option.Option<Upload>;
  /** The chunks that have not made up a part yet. */
  readonly pending: ReadonlyArray<Uint8Array>;
}

/** What a write holds before the first chunk arrives. */
const empty: Held = { upload: Option.none(), pending: [] };

/**
 * The sink a sequence is written into an object of a bucket through.
 */
export interface Sinks {
  /**
   * The sink a sequence is written into `id` of `bucket` through, as the parts of an upload it
   * fills.
   *
   * The upload is opened once a part is full, so a sequence shorter than one part is put as a single
   * object rather than completed as an upload of one part.
   * An upload the write never completes is dropped in the scope the sink is run in.
   */
  readonly writeSink: (
    bucket: string,
    id: string,
  ) => Effect.Effect<Sink.Sink<void, Uint8Array, never, ByteStore.ByteStoreError>, never, Scope>;
}

/**
 * The sinks of the bucket a program provides, built once where the store is.
 */
export const sinks: Effect.Effect<Sinks, never, S3Service> = Effect.map(S3Service, (s3) => ({
  writeSink: (bucket, id) =>
    Effect.gen(function* () {
      // The parts of an upload a write leaves open are dropped in the scope the sink runs in.
      const scope = yield* Effect.scope;

      const failed = ByteStore.ByteStoreError.from(id);

      const abort = (uploadId: string): Effect.Effect<void> =>
        s3
          .abortMultipartUpload({ Bucket: bucket, Key: id, UploadId: uploadId })
          .pipe(Effect.ignoreCause);

      const open = (): Effect.Effect<Upload, ByteStore.ByteStoreError, Scope> =>
        s3.createMultipartUpload({ Bucket: bucket, Key: id }).pipe(
          Effect.mapError(failed),
          Effect.flatMap(({ UploadId }) =>
            UploadId === undefined
              ? Effect.fail(failed("The bucket states no upload to send the parts under"))
              : Effect.succeed<Upload>({ id: UploadId, parts: [] }),
          ),
          // The bucket keeps the parts of an upload that is never completed until they are dropped.
          Effect.tap((upload) =>
            Effect.addFinalizer((exit) => (Exit.isSuccess(exit) ? Effect.void : abort(upload.id))),
          ),
        );

      const ensureUpload = (held: Held): Effect.Effect<Upload, ByteStore.ByteStoreError, Scope> =>
        Option.match(held.upload, { onNone: open, onSome: Effect.succeed });

      const send = (
        upload: Upload,
        bytes: Uint8Array,
      ): Effect.Effect<Upload, ByteStore.ByteStoreError> => {
        const PartNumber = upload.parts.length + 1;

        return s3
          .uploadPart({ Bucket: bucket, Key: id, UploadId: upload.id, PartNumber, Body: bytes })
          .pipe(
            Effect.mapError(failed),
            Effect.flatMap(({ ETag }) =>
              ETag === undefined
                ? Effect.fail(failed("The bucket states no ETag of the part it took"))
                : Effect.succeed<Upload>({
                    id: upload.id,
                    parts: [...upload.parts, { ETag, PartNumber }],
                  }),
            ),
          );
      };

      // Sends what the part being filled holds, so the next part starts empty.
      const flush = (
        upload: Upload,
        chunks: ReadonlyArray<Uint8Array>,
      ): Effect.Effect<Upload, ByteStore.ByteStoreError> =>
        chunks.length === 0 ? Effect.succeed(upload) : send(upload, Byte.concat(chunks));

      const push = (
        held: Held,
        bytes: Uint8Array,
      ): Effect.Effect<Held, ByteStore.ByteStoreError, Scope> => {
        const pending = [...held.pending, bytes];

        // A sequence is kept as it arrives, so what has not filled a part is held rather than sent.
        if (bytesIn(pending) < partSize) return Effect.succeed({ ...held, pending });

        return Effect.gen(function* () {
          const upload = yield* ensureUpload(held);
          const sent = yield* flush(upload, pending);

          return { upload: Option.some(sent), pending: [] };
        });
      };

      const finish = (held: Held): Effect.Effect<void, ByteStore.ByteStoreError> =>
        Effect.gen(function* () {
          // A sequence that never filled a part is kept as the one object it fits.
          if (Option.isNone(held.upload)) {
            return yield* s3
              .putObject({ Bucket: bucket, Key: id, Body: Byte.concat(held.pending) })
              .pipe(Effect.mapError(failed), Effect.asVoid);
          }

          // What the part being filled holds is the last part of the upload.
          const upload = yield* flush(held.upload.value, held.pending);

          yield* s3
            .completeMultipartUpload({
              Bucket: bucket,
              Key: id,
              UploadId: upload.id,
              MultipartUpload: { Parts: [...upload.parts] },
            })
            .pipe(Effect.mapError(failed));
        });

      return Sink.reduceEffect(() => empty, push).pipe(
        // What the write held is kept as the object once no more chunks arrive.
        Sink.mapEffect(finish),
        Sink.provideService(Scope, scope),
      );
    }),
}));
