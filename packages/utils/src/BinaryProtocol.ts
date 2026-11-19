/**
 * The binary layout of one message, stated as its fields in wire order.
 *
 * {@link layout} derives a {@link Layout} from the fields of a message.
 * {@link u8}, {@link u16}, {@link u32} and {@link u64} state an unsigned
 * integer field, and {@link bytes} states a run of bytes whose length is fixed
 * or counted by an earlier field.
 * Every field states one value as the `Uint8Array` its bytes span.
 * {@link decodeTo} states the value those bytes hold, and any other schema given
 * to {@link layout} is a field `SchemaBinary` writes as one frame.
 *
 * @stability experimental
 */

import { Data, Pipeable, Schema } from "effect";

import { readFrameLength } from "#/internal/binary-protocol/frame.ts";
import { layoutCodec } from "#/internal/binary-protocol/layout.ts";
import { unsignedBigInt, unsignedNumber } from "#/internal/binary-protocol/wire-integer.ts";

/**
 * How one field takes its bytes.
 *
 * **Details**
 *
 * - `integer` takes 1, 2, 4, or 8 bytes, big-endian.
 * - `bytes` takes `length` bytes when it is a number, and the bytes a named
 *   field counts when it is a string.
 *
 * @see {@link Field} for the field these bytes belong to.
 * @stability experimental
 * @category models
 */
export type Wire = Data.TaggedEnum<{
  integer: { readonly width: 1 | 2 | 4 | 8 };
  bytes: { readonly length: number | string };
}>;

const Wire = Data.taggedEnum<Wire>();

/**
 * One field of a {@link Layout}, taking its bytes from its own {@link Wire}.
 *
 * **Details**
 *
 * `wire` states the bytes the field spans and `schema` the value they hold.
 * The schema decodes the bytes of that span and encodes the value back to
 * bytes.
 *
 * @see {@link decodeTo} for stating a value the bytes do not name.
 * @stability experimental
 * @category models
 */
export interface Field<A> extends Pipeable.Pipeable {
  readonly schema: Schema.Codec<A, Uint8Array>;
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
 * one or hold more than the fields state.
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
 * A field is a {@link Field}, such as {@link u8}, or any other
 * {@link Schema.Codec}, which takes one `SchemaBinary` frame.
 * {@link decodeTo} states the value of a {@link Field} that its bytes do not
 * name.
 * A `length` that names a field counts the number that field's bytes state,
 * which is why the named field comes earlier in `fields`.
 * A length is a number, so an eight-byte field counts no run.
 *
 * **Gotchas**
 *
 * Deriving fails when a `length` names no field, names a later field, or names
 * a field that is not an integer one of at most four bytes.
 * Encoding fails when a run holds another number of bytes than its wire states,
 * or a value is of another range than its field.
 *
 * **Example** (A message written and read by one declaration)
 *
 * ```ts
 * import { Schema } from "effect"
 * import * as BinaryProtocol from "@trajs/utils/BinaryProtocol"
 *
 * const Stamp = BinaryProtocol.layout({
 *   kind: BinaryProtocol.u8,
 *   at: BinaryProtocol.u32
 * })
 *
 * Array.from(Schema.encodeSync(Stamp)({ kind: 7, at: 1 })) // => [7, 0, 0, 0, 1]
 * Schema.decodeSync(Stamp)(new Uint8Array([7, 0, 0, 0, 1])) // => { kind: 7, at: 1 }
 * ```
 *
 * @stability experimental
 * @category constructors
 */
export const layout = <A extends Record<string, unknown>>(fields: Fields<A>): Layout<A> =>
  layoutCodec(fields);

/**
 * How many bytes the frame at `offset` spans, or nothing where those bytes hold
 * no whole frame.
 *
 * **When to use**
 *
 * Use to walk a region holding one `SchemaBinary` frame per value without
 * decoding them, such as the bytes of a chunk.
 *
 * **Details**
 *
 * A frame states its own length first, so where it ends is read from the bytes
 * rather than from the value they hold.
 * The length is base-128, so it takes at most ten bytes.
 * A frame whose bytes end past `bytes` spans nothing, since it was not written
 * whole.
 *
 * @see {@link layout} for the field of a value that takes one frame.
 * @stability experimental
 * @category utils
 */
export const frameLength = (bytes: Uint8Array, offset: number): number | undefined =>
  readFrameLength(bytes, offset);

/** A field of `schema` over the bytes of `wire`. */
const makeField = <A>(schema: Schema.Codec<A, Uint8Array>, wire: Wire): Field<A> => ({
  ...Pipeable.Prototype,
  schema,
  wire,
});

/** A field of `width` unsigned bytes, big-endian. */
const integer = (width: 1 | 2 | 4): Field<number> =>
  makeField(unsignedNumber(width), Wire.integer({ width }));

/**
 * A field of one unsigned byte.
 *
 * @see {@link u16} for the field of two bytes.
 * @stability experimental
 * @category models
 */
export const u8: Field<number> = integer(1);

/**
 * A field of two unsigned bytes.
 *
 * @see {@link u32} for the field of four bytes.
 * @stability experimental
 * @category models
 */
export const u16: Field<number> = integer(2);

/**
 * A field of four unsigned bytes.
 *
 * @see {@link u64} for the field of eight bytes.
 * @see {@link bytes} for a run of bytes counted by this field.
 * @stability experimental
 * @category models
 */
export const u32: Field<number> = integer(4);

/**
 * A field of eight unsigned bytes.
 *
 * **Details**
 *
 * The value is a `bigint`, since a number holds an integer exactly only up to
 * 2^53 - 1.
 *
 * @see {@link u32} for the field of four bytes.
 * @stability experimental
 * @category models
 */
export const u64: Field<bigint> = makeField(unsignedBigInt(), Wire.integer({ width: 8 }));

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
 * A string names an earlier integer field, whose number counts the bytes of the
 * run.
 * The value is a view of the bytes of the message, not a copy.
 *
 * **Example** (A fixed run and a run of counted bytes)
 *
 * ```ts
 * import { Schema } from "effect"
 * import * as BinaryProtocol from "@trajs/utils/BinaryProtocol"
 *
 * const Frame = BinaryProtocol.layout({
 *   magic: BinaryProtocol.bytes(2),
 *   length: BinaryProtocol.u8,
 *   body: BinaryProtocol.bytes("length")
 * })
 *
 * const value = {
 *   magic: new Uint8Array([0x54, 0x52]),
 *   length: 2,
 *   body: new Uint8Array([1, 2])
 * }
 *
 * Array.from(Schema.encodeSync(Frame)(value)) // => [84, 82, 2, 1, 2]
 * ```
 *
 * @see {@link u32} for the field a length is usually counted with.
 * @stability experimental
 * @category constructors
 */
export const bytes = (length: number | string): Field<Uint8Array> =>
  makeField(Schema.Uint8Array, Wire.bytes({ length }));

/**
 * States the value of a field's bytes as a schema states it.
 *
 * **When to use**
 *
 * Use to give a field a value that its bytes do not name, such as a code of a
 * closed set, a text, or a branding.
 *
 * **Details**
 *
 * The schema is composed onto the codec of the field, which states the bytes.
 * The value is decoded from those bytes and encoded back to them, so the bytes
 * the field spans do not change.
 * A schema given to {@link layout} instead takes one `SchemaBinary` frame,
 * which states its own length.
 *
 * **Gotchas**
 *
 * A schema whose encoded side is no value of the field fails where the message
 * is read or written.
 *
 * **Example** (A code byte of a closed set)
 *
 * ```ts
 * import { Schema } from "effect"
 * import * as BinaryProtocol from "@trajs/utils/BinaryProtocol"
 *
 * const Code = Schema.Literals([0, 1])
 *
 * const Message = BinaryProtocol.layout({
 *   code: BinaryProtocol.u8.pipe(BinaryProtocol.decodeTo(Code))
 * })
 *
 * const read = Schema.decodeSync(Message)(new Uint8Array([1]))
 * read.code // => 1
 * ```
 *
 * @see {@link Field} for the wire the value takes its bytes from.
 * @see {@link bytes} for a field whose value is a run of bytes.
 * @stability experimental
 * @category combining
 */
export const decodeTo =
  <A, B>(schema: Schema.Codec<A, B>) =>
  <C>(field: Field<C>): Field<A> =>
    makeField(field.schema.pipe(Schema.decodeTo(schema)), field.wire);
