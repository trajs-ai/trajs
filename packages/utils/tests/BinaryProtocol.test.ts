/**
 * A layout read against the bytes it writes: the bytes of each wire, and the
 * messages a reader refuses.
 */

import { Effect, Option, Schema, SchemaGetter } from "effect";
import { SchemaBinary } from "effect/encoding";
import { describe, expect, it } from "vite-plus/test";

import * as BinaryProtocol from "#/BinaryProtocol.ts";

/** The text a run of bytes states, as UTF-8. */
const Utf8 = Schema.Uint8Array.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((bytes: Uint8Array) => new TextDecoder().decode(bytes)),
    encode: SchemaGetter.transform((text: string) => new TextEncoder().encode(text)),
  }),
);

/** A chunk header, as the fields of a layout state one. */
const Header = BinaryProtocol.layout({
  magic: BinaryProtocol.bytes(2),
  kind: BinaryProtocol.u8,
  length: BinaryProtocol.u16,
  payload: BinaryProtocol.bytes("length"),
});

const header = {
  magic: new Uint8Array([0x54, 0x52]),
  kind: 7,
  length: 3,
  payload: new Uint8Array([1, 2, 3]),
};

/** The bytes those values are written as, stated by hand. */
const headerBytes = new Uint8Array([0x54, 0x52, 7, 0, 3, 1, 2, 3]);

/** The message a layout refuses these bytes with. */
const decodeRefusal = (
  codec: Schema.Codec<unknown, Uint8Array<ArrayBuffer>>,
  bytes: Uint8Array<ArrayBuffer>,
): string => {
  const decode = Schema.decodeEffect(codec);

  return decode(bytes).pipe(Effect.flip, Effect.runSync).message;
};

/** The message a layout refuses this value with. */
const encodeRefusal = <A>(codec: Schema.Codec<A, Uint8Array<ArrayBuffer>>, value: A): string => {
  const encode = Schema.encodeEffect(codec);

  return encode(value).pipe(Effect.flip, Effect.runSync).message;
};

describe("layout", () => {
  it("writes the fields in the order they are named, as big-endian numbers", () => {
    expect(Schema.encodeSync(Header)(header)).toEqual(headerBytes);
  });

  it("reads back the values its bytes state", () => {
    expect(Schema.decodeSync(Header)(headerBytes)).toEqual(header);
  });

  it("reads a message that begins inside a larger buffer", () => {
    const held = new Uint8Array([0xff, 0xff, ...headerBytes, 0xff]);
    const view = held.subarray(2, 2 + headerBytes.length);

    expect(Schema.decodeSync(Header)(view)).toEqual(header);
  });

  it("writes and reads a run counted by a field of any integer width", () => {
    const Blob = BinaryProtocol.layout({
      size: BinaryProtocol.u32,
      body: BinaryProtocol.bytes("size"),
    });

    const body = new Uint8Array([1, 2, 3, 4, 5]);
    const bytes = Schema.encodeSync(Blob)({ size: body.length, body });

    expect(Array.from(bytes)).toEqual([0, 0, 0, 5, 1, 2, 3, 4, 5]);
    expect(Schema.decodeSync(Blob)(bytes)).toEqual({ size: 5, body });
  });

  it("writes no bytes for a run of no length", () => {
    const Empty = BinaryProtocol.layout({
      counted: BinaryProtocol.u8,
      run: BinaryProtocol.bytes("counted"),
      fixed: BinaryProtocol.bytes(0),
    });

    const empty = { counted: 0, run: new Uint8Array(), fixed: new Uint8Array() };
    const bytes = Schema.encodeSync(Empty)(empty);

    expect(Array.from(bytes)).toEqual([0]);
    expect(Schema.decodeSync(Empty)(bytes)).toEqual(empty);
  });

  it("writes no bytes for a layout of no fields", () => {
    const Nothing = BinaryProtocol.layout({});

    expect(Schema.encodeSync(Nothing)({})).toEqual(new Uint8Array());
    expect(Schema.decodeSync(Nothing)(new Uint8Array())).toEqual({});
    expect(decodeRefusal(Nothing, new Uint8Array([0x00]))).toBe(
      "the bytes hold 1 more than the fields of the layout",
    );
  });

  it("writes and reads a number of each width, up to the largest one", () => {
    const Numbers = BinaryProtocol.layout({
      byte: BinaryProtocol.u8,
      half: BinaryProtocol.u16,
      word: BinaryProtocol.u32,
    });

    const written = Schema.encodeSync(Numbers)({
      byte: 0x01,
      half: 0x0203,
      word: 0x0405_0607,
    });

    expect(Array.from(written)).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const largest = { byte: 0xff, half: 0xffff, word: 0xffff_ffff };
    const writtenLargest = Schema.encodeSync(Numbers)(largest);

    expect(Schema.decodeSync(Numbers)(writtenLargest)).toEqual(largest);
  });

  it("writes and reads an eight-byte number, big-endian", () => {
    const Stamp = BinaryProtocol.layout({ kind: BinaryProtocol.u8, at: BinaryProtocol.u64 });
    const value = { kind: 7, at: 0x0102_0304_0506_0708n };
    const bytes = Schema.encodeSync(Stamp)(value);

    expect(Array.from(bytes)).toEqual([7, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(Schema.decodeSync(Stamp)(bytes)).toEqual(value);
  });

  it("writes and reads the largest eight-byte number", () => {
    const Stamp = BinaryProtocol.layout({ at: BinaryProtocol.u64 });
    const largest = { at: 0xffff_ffff_ffff_ffffn };
    const bytes = Schema.encodeSync(Stamp)(largest);

    expect(Schema.decodeSync(Stamp)(bytes)).toEqual(largest);
  });

  it("refuses an eight-byte number the schema of its field does not bound", () => {
    const Stamp = BinaryProtocol.layout({ at: BinaryProtocol.u64 });

    const tooBig = Schema.encodeOption(Stamp)({ at: 0x1_0000_0000_0000_0000n });
    const negative = Schema.encodeOption(Stamp)({ at: -1n });

    expect(Option.isNone(tooBig)).toBe(true);
    expect(Option.isNone(negative)).toBe(true);
  });

  it("refuses a number the schema of its field does not bound", () => {
    const Numbers = BinaryProtocol.layout({ byte: BinaryProtocol.u8 });

    const tooBig = Schema.encodeOption(Numbers)({ byte: 0x100 });
    const negative = Schema.encodeOption(Numbers)({ byte: -1 });

    expect(Option.isNone(tooBig)).toBe(true);
    expect(Option.isNone(negative)).toBe(true);
  });

  it("keeps the range of its field where another schema states the value", () => {
    // A value schema restates the value of a field, not the bytes it spans, so
    // the range of the field still bounds it.
    const Word = BinaryProtocol.layout({
      value: BinaryProtocol.u8.pipe(BinaryProtocol.decodeTo(Schema.Number)),
    });

    const Stamp = BinaryProtocol.layout({
      value: BinaryProtocol.u64.pipe(BinaryProtocol.decodeTo(Schema.BigInt)),
    });

    expect(encodeRefusal(Word, { value: 0x100 })).toBe(
      'Expected a value less than or equal to 255\n  at ["value"]',
    );
    expect(encodeRefusal(Stamp, { value: 0x1_0000_0000_0000_0000n })).toBe(
      'Expected a value less than or equal to 18446744073709551615n\n  at ["value"]',
    );
  });

  it("refuses a run of another length than its wire states", () => {
    expect(encodeRefusal(Header, { ...header, magic: new Uint8Array([0x54]) })).toBe(
      "`magic` holds 1 bytes, and its field states 2",
    );

    expect(encodeRefusal(Header, { ...header, payload: new Uint8Array([1, 2]) })).toBe(
      "`payload` holds 2 bytes, and `length` states 3",
    );
  });

  it("refuses bytes that end inside a field", () => {
    const integer = headerBytes.subarray(0, 4);
    const run = headerBytes.subarray(0, 6);

    expect(decodeRefusal(Header, integer)).toBe("the bytes hold 1 of the 2 bytes of `length`");
    expect(decodeRefusal(Header, run)).toBe("the bytes hold 1 of the 3 bytes of `payload`");
  });

  it("refuses a length that counts more bytes than remain", () => {
    const lying = new Uint8Array([0x54, 0x52, 7, 0, 5, 1, 2]);

    expect(decodeRefusal(Header, lying)).toBe("the bytes hold 2 of the 5 bytes of `payload`");
  });

  it("refuses bytes the fields do not state", () => {
    const trailing = new Uint8Array([...headerBytes, 0x00]);

    expect(decodeRefusal(Header, trailing)).toBe(
      "the bytes hold 1 more than the fields of the layout",
    );
  });

  it("writes and reads a schema field as one SchemaBinary frame", () => {
    const Doc = BinaryProtocol.layout({ kind: BinaryProtocol.u8, name: Schema.String });
    const frame = Schema.encodeSync(SchemaBinary.toCodec(Schema.String))("trajs");
    const bytes = Schema.encodeSync(Doc)({ kind: 1, name: "trajs" });

    expect(Array.from(bytes)).toEqual([1, ...Array.from(frame)]);
    expect(Schema.decodeSync(Doc)(bytes)).toEqual({ kind: 1, name: "trajs" });
  });

  it("reads the fields after a schema field from the bytes the frame leaves", () => {
    const Cut = BinaryProtocol.layout({ name: Schema.String, count: BinaryProtocol.u8 });
    const bytes = Schema.encodeSync(Cut)({ name: "trajs", count: 3 });

    expect(bytes.at(-1)).toBe(3);
    expect(Schema.decodeSync(Cut)(bytes)).toEqual({ name: "trajs", count: 3 });
  });

  it("writes and reads a struct a schema field states", () => {
    const Meta = Schema.Struct({ name: Schema.String, version: Schema.Number });
    const Doc = BinaryProtocol.layout({ meta: Meta });
    const bytes = Schema.encodeSync(Doc)({ meta: { name: "run", version: 2 } });

    expect(Schema.decodeSync(Doc)(bytes)).toEqual({ meta: { name: "run", version: 2 } });
  });

  it("writes and reads a layout used as a schema field", () => {
    const Inner = BinaryProtocol.layout({ id: BinaryProtocol.u16, name: Schema.String });
    const Outer = BinaryProtocol.layout({ outer: BinaryProtocol.u8, inner: Inner });
    const value = { outer: 1, inner: { id: 0x0102, name: "run" } };
    const bytes = Schema.encodeSync(Outer)(value);

    expect(Schema.decodeSync(Outer)(bytes)).toEqual(value);
  });

  it("refuses bytes that hold no whole frame", () => {
    const Doc = BinaryProtocol.layout({ name: Schema.String });
    const inside = new Uint8Array([0x0a, 0x20]);

    expect(decodeRefusal(Doc, inside)).toBe("the bytes hold no whole frame for `name`");
  });

  it("reads a run as a view of the bytes it was read from", () => {
    const held = new Uint8Array([3, 1, 2, 3]);

    const Blob = BinaryProtocol.layout({
      size: BinaryProtocol.u8,
      body: BinaryProtocol.bytes("size"),
    });

    const { body } = Schema.decodeSync(Blob)(held);

    body[0] = 9;

    expect(Array.from(held)).toEqual([3, 9, 2, 3]);
  });

  it("derives no layout whose run counts no earlier integer field", () => {
    expect(() => BinaryProtocol.layout({ payload: BinaryProtocol.bytes("length") })).toThrow(
      "`payload` is sized by `length`, which is no field of the layout.",
    );

    expect(() =>
      BinaryProtocol.layout({
        payload: BinaryProtocol.bytes("length"),
        length: BinaryProtocol.u16,
      }),
    ).toThrow("`payload` is sized by `length`, which comes after it.");

    expect(() =>
      BinaryProtocol.layout({
        head: BinaryProtocol.bytes(1),
        payload: BinaryProtocol.bytes("head"),
      }),
    ).toThrow("`payload` is sized by `head`, which is not an integer field.");

    expect(() =>
      BinaryProtocol.layout({
        length: BinaryProtocol.u64,
        payload: BinaryProtocol.bytes("length"),
      }),
    ).toThrow("`payload` is sized by `length`, which states a bigint rather than a number.");
  });
});

describe("decodeTo", () => {
  it("reads a code byte as the value its schema states", () => {
    const Code = Schema.Literals([0, 1]);

    const Message = BinaryProtocol.layout({
      code: BinaryProtocol.u8.pipe(BinaryProtocol.decodeTo(Code)),
    });

    expect(Schema.decodeSync(Message)(new Uint8Array([1]))).toEqual({ code: 1 });
    expect(Schema.encodeSync(Message)({ code: 0 })).toEqual(new Uint8Array([0]));
    expect(Schema.decodeOption(Message)(new Uint8Array([2]))).toEqual(Option.none());
  });

  it("writes and reads a counted run as the text its bytes state", () => {
    const Named = BinaryProtocol.layout({
      length: BinaryProtocol.u8,
      name: BinaryProtocol.bytes("length").pipe(BinaryProtocol.decodeTo(Utf8)),
    });

    const bytes = Schema.encodeSync(Named)({ length: 5, name: "trajs" });

    expect(Array.from(bytes)).toEqual([5, 0x74, 0x72, 0x61, 0x6a, 0x73]);
    expect(Schema.decodeSync(Named)(bytes)).toEqual({ length: 5, name: "trajs" });
  });

  it("writes and reads a fixed run as the layout it holds", () => {
    const Pair = BinaryProtocol.layout({ first: BinaryProtocol.u8, second: BinaryProtocol.u8 });

    const Wrapped = BinaryProtocol.layout({
      pair: BinaryProtocol.bytes(2).pipe(BinaryProtocol.decodeTo(Pair)),
    });

    const value = { pair: { first: 1, second: 2 } };
    const bytes = Schema.encodeSync(Wrapped)(value);

    expect(Array.from(bytes)).toEqual([1, 2]);
    expect(Schema.decodeSync(Wrapped)(bytes)).toEqual(value);
  });

  it("refuses a value whose bytes are not those of its wire", () => {
    const Named = BinaryProtocol.layout({
      length: BinaryProtocol.u8,
      name: BinaryProtocol.bytes("length").pipe(BinaryProtocol.decodeTo(Utf8)),
    });

    const Fixed = BinaryProtocol.layout({
      name: BinaryProtocol.bytes(2).pipe(BinaryProtocol.decodeTo(Utf8)),
    });

    expect(encodeRefusal(Named, { length: 2, name: "trajs" })).toBe(
      "`name` holds 5 bytes, and `length` states 2",
    );
    expect(encodeRefusal(Fixed, { name: "trajs" })).toBe(
      "`name` holds 5 bytes, and its field states 2",
    );
  });

  it("refuses a value schema of another value than the field states", () => {
    // A field states the value of its own bytes, so a schema of another value is
    // refused where the message is read or written.
    const Misread = BinaryProtocol.layout({
      code: BinaryProtocol.u8.pipe(BinaryProtocol.decodeTo(Utf8)),
    });

    expect(encodeRefusal(Misread, { code: "trajs" })).toBe('Expected number\n  at ["code"]');
    expect(Schema.decodeOption(Misread)(new Uint8Array([0x74]))).toEqual(Option.none());
  });
});
