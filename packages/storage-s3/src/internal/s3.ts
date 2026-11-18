/**
 * What the answers of S3 state of the object a store keeps, beyond what the types the SDK ships
 * declare.
 */

import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";
import type { SdkError } from "@effect-aws/client-s3";
import * as ByteStore from "@trajs/utils/ByteStore";
import { Effect } from "effect";

/** The status S3 answers a range that begins at or past the end of an object with. */
const unservedStatus = 416;

/** What the SDK states of the answer a request failed with. */
interface Reported {
  readonly $metadata?: { readonly httpStatusCode?: number };
}

/**
 * Whether `cause` is a range that begins at or past the end of an object, which is not a failure of
 * the store.
 */
export const unserved = (cause: SdkError): boolean =>
  // SAFETY: the SDK states the status it answered with on every failure it raises, and
  // `effect-aws` keeps those fields on the failure it makes of them.
  (cause as Reported).$metadata?.httpStatusCode === unservedStatus;

/** The bytes of the body the response of a read carries. */
export const readBody = (
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
