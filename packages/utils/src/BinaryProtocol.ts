/**
 * The binary layout of one message, stated as its fields in wire order.
 *
 * {@link layout} derives a {@link Layout} from the fields of a message.
 * {@link u8}, {@link u16} and {@link u32} state an unsigned integer field, and
 * {@link bytes} states a run of bytes whose length is fixed or counted by an
 * earlier field.
 * Every other schema is a field written and read by `SchemaBinary`.
 *
 * @stability experimental
 */

import { Data, Schema } from "effect";

import { unsigned } from "#/internal/binary-protocol.ts";

/**
 * How one field takes its bytes.
 *
 * **Details**
 *
 * - `integer` takes 1, 2, or 4 bytes, big-endian.
 * - `bytes` takes `length` bytes when it is a number, and the bytes a named
 *   field counts when it is a string.
 *
 * @see {@link Field} for the field these bytes belong to.
 * @stability experimental
 * @category models
 */
export type Wire = Data.TaggedEnum<{
  integer: { readonly width: 1 | 2 | 4 };
  bytes: { readonly length: number | string };
}>;

const Wire = Data.taggedEnum<Wire>();

/**
 * One field of a {@link Layout}, taking its bytes from its own {@link Wire}.
 *
 * **Details**
 *
 * `schema` checks the value the field reads and writes, and states only its
 * decoded side: `wire` states the bytes.
 *
 * @see {@link bytes} for a field whose length an earlier field counts.
 * @stability experimental
 * @category models
 */
export interface Field<A> {
  readonly schema: Schema.Codec<A, unknown>;
  readonly wire: Wire;
}

/**
 * The fields of a {@link Layout} of `A`, named as `A` names them.
 *
 * **Details**
 *
 * A field is a {@link Field}, or any other {@link Schema.Codec} for a field
 * written and read by `SchemaBinary`.
 * Key order is wire order.
 *
 * @stability experimental
 * @category utility types
 */
export type Fields<A extends Record<string, unknown>> = {
  readonly [K in keyof A]: Field<A[K]> | Schema.Codec<A[K], unknown>;
};

/**
 * The codec of one message, whose fields are read and written in wire order.
 *
 * **Details**
 *
 * Decoding reads one field after another, and fails where the bytes end inside
 * one.
 * Encoding writes the fields in the same order, with no count or terminator
 * between them.
 *
 * @see {@link layout} for deriving a layout from the fields it reads.
 * @stability experimental
 * @category models
 */
export type Layout<A extends Record<string, unknown>> = Schema.Codec<
  { readonly [K in keyof A]: A[K] },
  Uint8Array<ArrayBuffer>
>;

/**
 * Derives the {@link Layout} of `A` from the fields of one message.
 *
 * **When to use**
 *
 * Use when a message is a run of fields that a reader walks in order.
 *
 * **Details**
 *
 * A `length` that names a field reads that field's value, which is why the
 * named field comes earlier in `fields`.
 *
 * **Gotchas**
 *
 * Deriving fails when a `length` names no field, names a later field, or names
 * a field that is not an integer one.
 * Encoding fails when a named length does not count the bytes of its run.
 *
 * @stability experimental
 * @category constructors
 */
export const layout = <A extends Record<string, unknown>>(fields: Fields<A>): Layout<A> => {
  throw new Error(
    `A layout states ${Object.keys(fields).length} fields, and its wire codec is not written yet.`,
  );
};

/**
 * A field of one unsigned byte.
 *
 * @see {@link u16} for the field of two bytes.
 * @stability experimental
 * @category models
 */
export const u8: Field<number> = {
  schema: unsigned(0xff),
  wire: Wire.integer({ width: 1 }),
};

/**
 * A field of two unsigned bytes.
 *
 * @see {@link u32} for the field of four bytes.
 * @stability experimental
 * @category models
 */
export const u16: Field<number> = {
  schema: unsigned(0xffff),
  wire: Wire.integer({ width: 2 }),
};

/**
 * A field of four unsigned bytes.
 *
 * @see {@link bytes} for a run of bytes counted by this field.
 * @stability experimental
 * @category models
 */
export const u32: Field<number> = {
  schema: unsigned(0xffff_ffff),
  wire: Wire.integer({ width: 4 }),
};

/**
 * A field of `length` bytes, counted by a field it names when a string.
 *
 * **When to use**
 *
 * Use for a run of bytes the message itself sizes, such as a payload.
 *
 * **Details**
 *
 * A number states how many bytes the field always takes.
 * A string names an earlier field of `fields`, whose value counts the bytes in
 * the run.
 *
 * @see {@link u32} for the field a length is usually counted with.
 * @stability experimental
 * @category constructors
 */
export const bytes = (length: number | string): Field<Uint8Array> => ({
  schema: Schema.Uint8Array,
  wire: Wire.bytes({ length }),
});
