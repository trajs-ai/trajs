/**
 * The bytes a layout's fields span, and the schema stating each of them.
 *
 * An integer field takes its width, big-endian; a run takes the length its wire
 * states; and a field any schema states takes one `SchemaBinary` frame. Every
 * field decodes and encodes the `Uint8Array` its wire spans, so one declaration
 * both reads and writes a message.
 */

import { Effect, Match, Pipeable, Schema, SchemaGetter, SchemaIssue } from "effect";
import { SchemaBinary } from "effect/encoding";

import type { Field, Fields, Wire } from "#/BinaryProtocol.ts";

/** The field that states `schema` over the bytes of `wire`. */
export const fieldOf = <A>(schema: Schema.Codec<A, Uint8Array>, wire: Wire): Field<A> => ({
  ...Pipeable.Prototype,
  schema,
  wire,
});

/** The issue of bytes or values that state nothing the layout asks for. */
const issue = (message: string): SchemaIssue.Issue => new SchemaIssue.InvalidValue({ message });

/** The view the bytes of a span are read from, from where the span begins. */
const viewOf = (bytes: Uint8Array<ArrayBufferLike>): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** The largest number `width` bytes hold. */
const maximumOf = (width: 1 | 2 | 4): number => 2 ** (8 * width) - 1;

/** The number the leading big-endian bytes of a span state. */
const firstNumber = (span: Uint8Array, width: 1 | 2 | 4): number => {
  const view = viewOf(span);

  switch (width) {
    case 1:
      return view.getUint8(0);
    case 2:
      return view.getUint16(0);
    case 4:
      return view.getUint32(0);
  }
};

/** The number the span of an integer field of `width` states, big-endian. */
const numberOf = (span: Uint8Array, width: 1 | 2 | 4): Effect.Effect<number, SchemaIssue.Issue> =>
  span.length === width
    ? Effect.succeed(firstNumber(span, width))
    : Effect.fail(issue(`an integer field of ${width} bytes spans ${span.length}`));

/** The `width` big-endian bytes stating `value`. */
const bytesOfNumber = (value: number, width: 1 | 2 | 4): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(width);
  const view = viewOf(bytes);

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

/** The bigint the eight big-endian bytes of a span state. */
const bigintOf = (span: Uint8Array): Effect.Effect<bigint, SchemaIssue.Issue> =>
  span.length === 8
    ? Effect.succeed(viewOf(span).getBigUint64(0))
    : Effect.fail(issue(`an integer field of 8 bytes spans ${span.length}`));

/** The eight big-endian bytes stating `value`. */
const bytesOfBigint = (value: bigint): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(8);

  viewOf(bytes).setBigUint64(0, value);

  return bytes;
};

/** The schema of an unsigned integer field of `width` bytes, big-endian. */
export const unsigned = (width: 1 | 2 | 4) => {
  const value = Schema.Int.check(
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(maximumOf(width)),
  );

  return Schema.Uint8Array.pipe(
    Schema.decodeTo(value, {
      decode: SchemaGetter.transformEffect((span: Uint8Array) => numberOf(span, width)),
      encode: SchemaGetter.transform((written: number) => bytesOfNumber(written, width)),
    }),
  );
};

/** The schema of an unsigned integer field of eight bytes, big-endian. */
export const unsignedBig = () => {
  const value = Schema.BigInt.check(
    Schema.isGreaterThanOrEqualToBigInt(0n),
    Schema.isLessThanOrEqualToBigInt(0xffff_ffff_ffff_ffffn),
  );

  return Schema.Uint8Array.pipe(
    Schema.decodeTo(value, {
      decode: SchemaGetter.transformEffect((span: Uint8Array) => bigintOf(span)),
      encode: SchemaGetter.transform((written: bigint) => bytesOfBigint(written)),
    }),
  );
};

/** The bytes one field spans, by the name of the field. */
type Spans = Record<string, Uint8Array>;

/** The width of each integer field of a layout, by the name of the field. */
type Widths = Map<string, 1 | 2 | 4 | 8>;

/** One field of a layout, and the bytes it takes. */
type Slot =
  | {
      readonly name: string;
      readonly kind: "integer";
      readonly width: 1 | 2 | 4 | 8;
      readonly schema: Schema.Top;
    }
  | {
      readonly name: string;
      readonly kind: "bytes";
      readonly length: number | string;
      readonly schema: Schema.Top;
    }
  | { readonly name: string; readonly kind: "frame"; readonly schema: Schema.Top };

/**
 * Derives the codec of one message from the fields of a layout.
 *
 * Deriving fails where a byte run counts a field that no earlier integer field
 * states.
 */
export const codecOf = <A extends Record<string, unknown>>(
  fields: Fields<A>,
): Schema.Codec<A, Uint8Array<ArrayBuffer>> => {
  const slots = slotsOf(fields);
  const widths = widthsOf(slots);
  const struct: Schema.Top = Schema.Struct(schemasOf(slots));

  // SAFETY: each slot states the schema of the field of `A` it is named by, so the
  // struct states the value of each field of `A`; the bytes it reads and writes for
  // that field are the span its wire states, which both sides check as they take it.
  const message = struct as Schema.Codec<A, Spans>;

  const codec: Schema.Codec<A, Uint8Array<ArrayBufferLike>> = Schema.Uint8Array.pipe(
    Schema.decodeTo(message, {
      decode: SchemaGetter.transformEffect((bytes) => readFields(slots, widths, bytes)),
      encode: SchemaGetter.transformEffect((spans) => writeFields(slots, widths, spans)),
    }),
  );

  // SAFETY: the fields write their bytes into one buffer the layout allocates, so
  // the bytes a message encodes to are backed by an `ArrayBuffer`.
  return codec as Schema.Codec<A, Uint8Array<ArrayBuffer>>;
};

/** The slots of a layout, failing where a byte run counts no earlier integer. */
const slotsOf = <A extends Record<string, unknown>>(fields: Fields<A>): ReadonlyArray<Slot> => {
  const slots = Object.entries(fields).map(([name, field]) =>
    Schema.isSchema(field) ? frameSlot(name, field) : wireSlot(name, field),
  );

  for (const [index, slot] of slots.entries()) {
    if (slot.kind !== "bytes") {
      continue;
    }

    const length = slot.length;

    if (!Schema.is(Schema.String)(length)) {
      continue;
    }

    const earlier = slots.findIndex((other) => other.name === length);

    if (earlier < 0) {
      throw new Error(
        `\`${slot.name}\` is sized by \`${length}\`, which is no field of the layout.`,
      );
    }

    if (earlier > index) {
      throw new Error(`\`${slot.name}\` is sized by \`${length}\`, which comes after it.`);
    }

    const source = slots[earlier];

    if (source?.kind !== "integer") {
      throw new Error(`\`${slot.name}\` is sized by \`${length}\`, which is not an integer field.`);
    }

    // A length is a number, and an eight-byte field states a bigint.
    if (source.width === 8) {
      throw new Error(
        `\`${slot.name}\` is sized by \`${length}\`, which states a bigint rather than a number.`,
      );
    }
  }

  return slots;
};

/** The width of each integer field of a layout. */
const widthsOf = (slots: ReadonlyArray<Slot>): Widths => {
  const widths: Widths = new Map();

  for (const slot of slots) {
    if (slot.kind === "integer") {
      widths.set(slot.name, slot.width);
    }
  }

  return widths;
};

/** The slot of a field whose wire states the bytes it takes. */
const wireSlot = <Value>(name: string, field: Field<Value>): Slot =>
  Match.value(field.wire).pipe(
    Match.tag("integer", (wire): Slot => ({
      name,
      kind: "integer",
      width: wire.width,
      schema: field.schema,
    })),
    Match.tag("bytes", (wire): Slot => ({
      name,
      kind: "bytes",
      length: wire.length,
      schema: field.schema,
    })),
    Match.exhaustive,
  );

/** The slot of a field any schema states, taking one `SchemaBinary` frame. */
const frameSlot = (name: string, schema: Schema.Top): Slot => ({
  name,
  kind: "frame",
  schema: SchemaBinary.toCodec(schema),
});

/** The schema of each slot, in the order the fields are read and written. */
const schemasOf = (slots: ReadonlyArray<Slot>): Schema.Struct.Fields => {
  const schemas: Record<string, Schema.Top> = {};

  for (const slot of slots) {
    schemas[slot.name] = slot.schema;
  }

  return schemas;
};

/** The bytes the fields of a layout span in one message. */
const readFields = (
  slots: ReadonlyArray<Slot>,
  widths: Widths,
  bytes: Uint8Array<ArrayBufferLike>,
): Effect.Effect<Spans, SchemaIssue.Issue> =>
  Effect.gen(function* () {
    const spans: Spans = {};
    let at = 0;

    for (const slot of slots) {
      const left = bytes.length - at;

      if (slot.kind === "integer") {
        if (left < slot.width) {
          return yield* Effect.fail(shortOf(slot.name, left, slot.width));
        }

        spans[slot.name] = bytes.subarray(at, at + slot.width);
        at += slot.width;

        continue;
      }

      if (slot.kind === "bytes") {
        const length = yield* lengthOf(slot.name, slot.length, spans, widths);

        if (left < length) {
          return yield* Effect.fail(shortOf(slot.name, left, length));
        }

        spans[slot.name] = bytes.subarray(at, at + length);
        at += length;

        continue;
      }

      const size = frameSize(bytes, at);

      if (size === undefined) {
        return yield* Effect.fail(issue(`the bytes hold no whole frame for \`${slot.name}\``));
      }

      spans[slot.name] = bytes.subarray(at, at + size);
      at += size;
    }

    // The layout states no field for the bytes left over, so they are not of the
    // message its fields describe.
    if (at !== bytes.length) {
      return yield* Effect.fail(
        issue(`the bytes hold ${bytes.length - at} more than the fields of the layout`),
      );
    }

    return spans;
  });

/** The bytes the fields of a layout write for the values of one message. */
const writeFields = (
  slots: ReadonlyArray<Slot>,
  widths: Widths,
  spans: Spans,
): Effect.Effect<Uint8Array<ArrayBuffer>, SchemaIssue.Issue> =>
  Effect.gen(function* () {
    const chunks: Array<Uint8Array> = [];

    for (const slot of slots) {
      const span = spans[slot.name];

      if (span === undefined) {
        return yield* Effect.fail(issue(`no value is written for \`${slot.name}\``));
      }

      if (slot.kind === "bytes") {
        const length = yield* lengthOf(slot.name, slot.length, spans, widths);

        if (span.length !== length) {
          const stated = Schema.is(Schema.String)(slot.length)
            ? `\`${slot.length}\` states`
            : "its field states";

          return yield* Effect.fail(
            issue(`\`${slot.name}\` holds ${span.length} bytes, and ${stated} ${length}`),
          );
        }
      }

      // An integer is written by its own schema, so its width is checked here
      // where the wire states it.
      if (slot.kind === "integer" && span.length !== slot.width) {
        return yield* Effect.fail(
          issue(`\`${slot.name}\` holds ${span.length} bytes, and its field states ${slot.width}`),
        );
      }

      chunks.push(span);
    }

    const bytes = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
    let at = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }

    return bytes;
  });

/** The most bytes the length of a frame takes. */
const FrameLengthBytes = 10;

/**
 * How many bytes the frame at `offset` spans, or nothing where the bytes there
 * hold no whole frame.
 *
 * A frame states its own length first, so where it ends is read from the bytes
 * rather than from the value they hold.
 */
const frameSize = (bytes: Uint8Array, offset: number): number | undefined => {
  let scale = 1;
  let length = 0;

  for (let at = offset; at < offset + FrameLengthBytes && at < bytes.length; at += 1) {
    const byte = bytes[at]!;

    length += (byte & 0x7f) * scale;

    if ((byte & 0x80) === 0) {
      const size = at + 1 - offset + length;

      return offset + size > bytes.length ? undefined : size;
    }

    scale *= 128;
  }

  return undefined;
};

/** The number of bytes a run takes, from the field its wire counts with. */
const lengthOf = (
  name: string,
  length: number | string,
  spans: Spans,
  widths: Widths,
): Effect.Effect<number, SchemaIssue.Issue> =>
  Schema.is(Schema.String)(length)
    ? countedBy(name, length, spans, widths)
    : Effect.succeed(length);

/** How many bytes the field a run is counted by states, or why it states none. */
const countedBy = (
  name: string,
  counted: string,
  spans: Spans,
  widths: Widths,
): Effect.Effect<number, SchemaIssue.Issue> => {
  const span = spans[counted];
  const width = widths.get(counted);

  return span === undefined || width === undefined || width === 8
    ? Effect.fail(
        issue(
          `\`${counted}\` counts the bytes of \`${name}\`, so it is an integer field of at most four bytes`,
        ),
      )
    : Effect.succeed(firstNumber(span, width));
};

/** The issue of bytes that end inside a field. */
const shortOf = (name: string, left: number, bytes: number): SchemaIssue.Issue =>
  issue(`the bytes hold ${left} of the ${bytes} bytes of \`${name}\``);
