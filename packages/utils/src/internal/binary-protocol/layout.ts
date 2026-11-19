/** The slots a layout's fields take, in wire order, and the codec that reads and writes them. */

import { Match, Schema, SchemaGetter } from "effect";
import { SchemaBinary } from "effect/encoding";

import type { Field, Fields } from "#/BinaryProtocol.ts";
import { readFields, writeFields } from "#/internal/binary-protocol/message-bytes.ts";

/** The bytes one field spans, by the name of the field. */
export type Spans = Record<string, Uint8Array>;

/** The integer field a run of bytes is counted by, and the width of the number it states. */
export interface Counted {
  readonly field: string;
  readonly width: 1 | 2 | 4;
}

/** The bytes one field of a layout takes, and the schema stating the value they hold. */
export type Slot =
  | {
      readonly name: string;
      readonly kind: "integer";
      readonly width: 1 | 2 | 4 | 8;
      readonly schema: Schema.Top;
    }
  | {
      readonly name: string;
      readonly kind: "bytes";
      readonly length: number;
      readonly schema: Schema.Top;
    }
  | {
      readonly name: string;
      readonly kind: "counted";
      readonly counted: Counted;
      readonly schema: Schema.Top;
    }
  | { readonly name: string; readonly kind: "frame"; readonly schema: Schema.Top };

/** A slot whose run of bytes has yet to resolve the field that counts it. */
type Draft =
  | Exclude<Slot, { readonly kind: "bytes" } | { readonly kind: "counted" }>
  | {
      readonly name: string;
      readonly kind: "bytes";
      readonly length: number | string;
      readonly schema: Schema.Top;
    };

/** The slot of a field whose wire states the bytes it takes. */
const wireSlot = <Value>(name: string, field: Field<Value>): Draft =>
  Match.value(field.wire).pipe(
    Match.tag("integer", (wire): Draft => ({
      name,
      kind: "integer",
      width: wire.width,
      schema: field.schema,
    })),
    Match.tag("bytes", (wire): Draft => ({
      name,
      kind: "bytes",
      length: wire.length,
      schema: field.schema,
    })),
    Match.exhaustive,
  );

/** The slot of a field any schema states, taking one `SchemaBinary` frame. */
const frameSlot = (name: string, schema: Schema.Top): Draft => ({
  name,
  kind: "frame",
  schema: SchemaBinary.toCodec(schema),
});

/**
 * The earlier integer field a run of bytes is counted by, and the width of the
 * number it states.
 *
 * A layout states the same wrong length on every read of it, so a length no
 * earlier integer field counts is refused here, where the layout is derived,
 * rather than as the `SchemaIssue` a wrong message fails with.
 */
const countedSlot = (
  slots: ReadonlyArray<Draft>,
  index: number,
  name: string,
  field: string,
): Counted => {
  const earlier = slots.findIndex((other) => other.name === field);

  if (earlier < 0) {
    throw new Error(`\`${name}\` is sized by \`${field}\`, which is no field of the layout.`);
  }

  if (earlier > index) {
    throw new Error(`\`${name}\` is sized by \`${field}\`, which comes after it.`);
  }

  const source = slots[earlier]!;

  if (source.kind !== "integer") {
    throw new Error(`\`${name}\` is sized by \`${field}\`, which is not an integer field.`);
  }

  // A length is a number, and an eight-byte field states a bigint.
  if (source.width === 8) {
    throw new Error(
      `\`${name}\` is sized by \`${field}\`, which states a bigint rather than a number.`,
    );
  }

  return { field, width: source.width };
};

/** The slot of one field, with the field a counted run of its bytes is sized by. */
const resolveSlot = (slots: ReadonlyArray<Draft>, index: number, slot: Draft): Slot => {
  if (slot.kind !== "bytes") {
    return slot;
  }

  return Schema.is(Schema.String)(slot.length)
    ? {
        name: slot.name,
        kind: "counted",
        counted: countedSlot(slots, index, slot.name, slot.length),
        schema: slot.schema,
      }
    : { name: slot.name, kind: "bytes", length: slot.length, schema: slot.schema };
};

/** The slots of a layout, in the order its fields are read and written. */
const layoutSlots = <A extends Record<string, unknown>>(fields: Fields<A>): ReadonlyArray<Slot> => {
  const slots = Object.entries(fields).map(([name, field]) =>
    Schema.isSchema(field) ? frameSlot(name, field) : wireSlot(name, field),
  );

  return slots.map((slot, index) => resolveSlot(slots, index, slot));
};

/** The schema of each slot, in the order the fields are read and written. */
const fieldSchemas = (slots: ReadonlyArray<Slot>): Schema.Struct.Fields => {
  const schemas: Record<string, Schema.Top> = {};

  for (const slot of slots) {
    schemas[slot.name] = slot.schema;
  }

  return schemas;
};

/**
 * The codec of one message, whose fields are read and written in wire order.
 *
 * Deriving fails where a byte run counts a field that no earlier integer field
 * states.
 */
export const layoutCodec = <A extends Record<string, unknown>>(
  fields: Fields<A>,
): Schema.Codec<A, Uint8Array<ArrayBuffer>> => {
  const slots = layoutSlots(fields);
  const struct: Schema.Top = Schema.Struct(fieldSchemas(slots));

  // SAFETY: each slot states the schema of the field of `A` it is named by, so the
  // struct states the value of each field of `A`; the bytes it reads and writes for
  // that field are the span its wire states, which both sides check as they take it.
  const message = struct as Schema.Codec<A, Spans>;

  const codec: Schema.Codec<A, Uint8Array<ArrayBufferLike>> = Schema.Uint8Array.pipe(
    Schema.decodeTo(message, {
      decode: SchemaGetter.transformEffect((bytes: Uint8Array<ArrayBufferLike>) =>
        readFields(slots, bytes),
      ),
      encode: SchemaGetter.transformEffect((spans: Spans) => writeFields(slots, spans)),
    }),
  );

  // SAFETY: the fields are written into one buffer `concat` allocates, so the bytes
  // a message encodes to are backed by an `ArrayBuffer`.
  return codec as Schema.Codec<A, Uint8Array<ArrayBuffer>>;
};
