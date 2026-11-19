/** The bytes of an unsigned integer field, big-endian, and the schemas that state a value from them. */

import { Effect, Schema, SchemaGetter } from "effect";

import { integerSpan } from "#/internal/binary-protocol/binary-issue.ts";

/** The view the bytes of a span are read from, from where the span begins. */
const dataView = (bytes: Uint8Array<ArrayBufferLike>): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** The largest number `width` bytes hold. */
const largestNumber = (width: 1 | 2 | 4): number => 2 ** (8 * width) - 1;

/** The number the leading big-endian bytes of a span state. */
export const readNumber = (span: Uint8Array, width: 1 | 2 | 4): number => {
  const view = dataView(span);

  switch (width) {
    case 1:
      return view.getUint8(0);
    case 2:
      return view.getUint16(0);
    case 4:
      return view.getUint32(0);
  }
};

/** The `width` big-endian bytes stating `value`. */
const writeNumber = (value: number, width: 1 | 2 | 4): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(width);
  const view = dataView(bytes);

  switch (width) {
    case 1:
      view.setUint8(0, value);
      break;
    case 2:
      view.setUint16(0, value);
      break;
    case 4:
      view.setUint32(0, value);
      break;
  }

  return bytes;
};

/** The eight big-endian bytes stating `value`. */
const writeBigInt = (value: bigint): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(8);

  dataView(bytes).setBigUint64(0, value);

  return bytes;
};

/** The schema of an unsigned integer field of `width` bytes, big-endian. */
export const unsignedNumber = (width: 1 | 2 | 4) => {
  const value = Schema.Int.check(
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(largestNumber(width)),
  );

  return Schema.Uint8Array.pipe(
    Schema.decodeTo(value, {
      decode: SchemaGetter.transformEffect((span: Uint8Array) =>
        span.length === width
          ? Effect.succeed(readNumber(span, width))
          : Effect.fail(integerSpan(width, span.length)),
      ),
      encode: SchemaGetter.transform((written: number) => writeNumber(written, width)),
    }),
  );
};

/** The schema of an unsigned integer field of eight bytes, big-endian. */
export const unsignedBigInt = () => {
  const value = Schema.BigInt.check(
    Schema.isGreaterThanOrEqualToBigInt(0n),
    Schema.isLessThanOrEqualToBigInt(0xffff_ffff_ffff_ffffn),
  );

  return Schema.Uint8Array.pipe(
    Schema.decodeTo(value, {
      decode: SchemaGetter.transformEffect((span: Uint8Array) =>
        span.length === 8
          ? Effect.succeed(dataView(span).getBigUint64(0))
          : Effect.fail(integerSpan(8, span.length)),
      ),
      encode: SchemaGetter.transform((written: bigint) => writeBigInt(written)),
    }),
  );
};
