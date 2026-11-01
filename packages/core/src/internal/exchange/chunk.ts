import { Checksum, Compression, StreamHash } from "@trajs/utils";
import * as BinaryProtocol from "@trajs/utils/BinaryProtocol";
import type { CompressionError } from "@trajs/utils/Compression";
import { Effect, Option, Schema, Stream } from "effect";

import * as part from "#/internal/exchange/part.ts";
import { ChainBytes } from "#/internal/schema.ts";

const chunkHeaderFields = {
  metaCrc: BinaryProtocol.u32,
  bodyCrc: BinaryProtocol.u32,
  bodyLen: BinaryProtocol.u32,
  metaLen: BinaryProtocol.u32,
  compression: BinaryProtocol.u8.pipe(BinaryProtocol.decodeTo(Compression.Algorithm)),
};

// `bodyCrc` covers the body region alone, so the chain value sits outside it.
export const Chunk = BinaryProtocol.toCodec({
  ...chunkHeaderFields,
  meta: BinaryProtocol.bytesOf("metaLen"),
  body: BinaryProtocol.bytesOf("bodyLen"),
  chain: BinaryProtocol.bytes(ChainBytes),
});

export type Chunk = Schema.Schema.Type<typeof Chunk>;

// One part's meta segment and the body segment it pairs.
export type Frame = Pick<Chunk, "meta" | "body">;

// What a scan reads alone, before it knows a chunk's extent.
export const ChunkHeader = BinaryProtocol.toCodec(chunkHeaderFields);

export type ChunkHeader = Schema.Schema.Type<typeof ChunkHeader>;

// The two `u32` checksums a header states first, so the bytes `metaCrc` covers begin after
// them (section 5).
const ChecksumBytes = 8;

// Four `u32`s and the compression codec, which precede the two regions.
const ChunkHeaderBytes = 17;

// A chunk states its own extent, so a scan reads it before trusting its lengths.
export const chunkLen = (header: ChunkHeader): number =>
  ChunkHeaderBytes + ChainBytes + header.metaLen + header.bodyLen;

// A truncated tail is a writer that stopped inside a write, so it yields no chunk.
export const chunkOf = (
  bytes: Uint8Array,
): { readonly chunk: Chunk; readonly rest: Uint8Array } | undefined => {
  const header = Schema.decodeUnknownOption(ChunkHeader)(bytes.subarray(0, ChunkHeaderBytes));

  if (Option.isNone(header)) {
    return undefined;
  }

  const len = chunkLen(header.value);

  if (len > bytes.length) {
    return undefined;
  }

  // The chunk is decoded whole, so its regions are the ones the header states.
  const chunk = Schema.decodeUnknownOption(Chunk)(bytes.subarray(0, len));

  return Option.isNone(chunk) ? undefined : { chunk: chunk.value, rest: bytes.subarray(len) };
};

// The chain value that extends `prev` over `bytes` (section 5.2).
// A trajectory starts from `Magic`, so its first value is `chainOf(hash, Magic)`.
export const chainOf = (
  hash: StreamHash.Algorithm,
  prev: Uint8Array,
  bytes?: Uint8Array,
): Effect.Effect<Uint8Array, never, StreamHash.StreamHash> =>
  Effect.gen(function* () {
    const streamHash = yield* StreamHash.StreamHash;

    // The header states no digest length, so the cut to a chain value is applied here.
    const hashing = streamHash.start({ algorithm: hash, length: ChainBytes });

    hashing.update(prev);

    if (bytes !== undefined) {
      hashing.update(bytes);
    }

    return hashing.digest();
  });

const joined = (rest: Uint8Array, chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const bytes = new Uint8Array(
    rest.length + chunks.reduce((size, chunk) => size + chunk.length, 0),
  );

  bytes.set(rest);

  let at = rest.length;

  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }

  return bytes;
};

export const encodeChunk = (
  hash: StreamHash.Algorithm,
  prev: Uint8Array,
  {
    frames,
    algorithm,
  }: {
    readonly frames: ReadonlyArray<Frame>;
    readonly algorithm: Compression.Algorithm;
  },
): Effect.Effect<
  Uint8Array,
  CompressionError,
  Checksum.Checksum | Compression.Compression | StreamHash.StreamHash
> =>
  Effect.gen(function* () {
    const checksum = yield* Checksum.Checksum;
    const compression = yield* Compression.Compression;

    const meta = joined(
      new Uint8Array(),
      frames.map((frame) => frame.meta),
    );

    const bodies = joined(
      new Uint8Array(),
      frames.map((frame) => frame.body),
    );

    const packed = yield* compression.compressBytes({ algorithm })(bodies);

    // A region the codec does not make smaller is stored unwrapped (section 5.1).
    const smaller = packed.length < bodies.length;

    const body = smaller ? packed : bodies;
    const code = smaller ? algorithm : Compression.Algorithm.enums.None;
    const bodyLen = body.length;

    // A length beyond a `u32` is refused where a part is accepted (section 14).
    const metaLen = meta.length;
    const crc = checksum.of({ algorithm: Checksum.Algorithm.enums.Crc32 });

    // A checksum sits before the bytes it covers, so the header is laid out twice:
    // once with both checksums zero, and once with them read.
    const header = { metaCrc: 0, bodyCrc: 0, bodyLen, metaLen, compression: code };
    const headerBytes = Schema.encodeSync(ChunkHeader)(header);

    // `metaCrc` covers the header past its two checksums, and the meta region (section 5).
    const afterChecksums = headerBytes.subarray(ChecksumBytes);
    const metaCrc = crc(joined(afterChecksums, [meta]));

    const bodyCrc = crc(body);

    // The chain value extends over the chunk through its body (section 5.2).
    const unchained = joined(new Uint8Array(), [
      Schema.encodeSync(ChunkHeader)({ ...header, metaCrc, bodyCrc }),
      meta,
      body,
    ]);

    const chain = yield* chainOf(hash, prev, unchained);

    return joined(unchained, [chain]);
  });

// Membership is decided on the raw size of frames, before they are compressed.
export const DefaultChunkSize = 2 * 1024 * 1024;

// A chunk holds frames until the raw size would pass `chunkSize`, then closes
// before that frame (section 10).
export const chunkFramesOf =
  (chunkSize: number = DefaultChunkSize) =>
  <E, R>(frames: Stream.Stream<Frame, E, R>): Stream.Stream<ReadonlyArray<Frame>, E, R> =>
    Stream.suspend(() => {
      let held: Array<Frame> = [];
      let size = 0;

      return frames.pipe(
        Stream.mapAccumArray(
          () => undefined,
          (_state, batch) => {
            const out: Array<ReadonlyArray<Frame>> = [];

            for (const frame of batch) {
              const raw = frame.meta.length + frame.body.length;

              if (held.length > 0 && size + raw > chunkSize) {
                out.push(held);

                held = [];
                size = 0;
              }

              held.push(frame);
              size += raw;
            }

            return [undefined, out] as const;
          },
        ),
        Stream.concat(Stream.suspend(() => (held.length === 0 ? Stream.empty : Stream.make(held)))),
      );
    });

// The marker begins every trajectory and ends every file, so it states no place
// of its own.
export const Magic = new TextEncoder().encode("TRAJS");

// A header is not a chunk, so nothing of it is a body. Its chain value extends
// the one `Magic` starts, so a reader checks it with no chunk before it.
export const Header = BinaryProtocol.toCodec({
  crc: BinaryProtocol.u32,
  header: BinaryProtocol.frame(part.Header),
  chain: BinaryProtocol.bytes(ChainBytes),
});

export type Header = Schema.Schema.Type<typeof Header>;

// One data chunk in file order: its whole size, the size of its meta region,
// and its frame count.
const chunkEntry = BinaryProtocol.struct({
  len: BinaryProtocol.u32,
  metaLen: BinaryProtocol.u32,
  count: BinaryProtocol.u32,
});

// A footer is not a chunk, so nothing of it is a body. The checksum and the chain
// value are stated before the entry table, so the entries end the footer.
export const Footer = BinaryProtocol.toCodec({
  crc: BinaryProtocol.u32,
  chain: BinaryProtocol.bytes(ChainBytes),
  // `footerLen` states the size of the footer, so the entries need no count.
  chunks: BinaryProtocol.array(chunkEntry),
});

export type Footer = Schema.Schema.Type<typeof Footer>;

// `footerLen` and the marker end every file, so a locate reads them alone.
export const FooterTail = BinaryProtocol.toCodec({
  footerLen: BinaryProtocol.u32,
  magic: BinaryProtocol.bytes(Magic.length),
});

export type FooterTail = Schema.Schema.Type<typeof FooterTail>;

// A `u32` and the marker, which end every file, so a locate reads them alone.
export const FooterTailBytes = 4 + Magic.length;

// A reader confirms the place against the header and the footer.
export const footerStartOf = (length: bigint, tail: Uint8Array): bigint | undefined => {
  if (tail.length < FooterTailBytes) {
    return undefined;
  }

  // The two fields end the file, so they are read from the end of whatever the tail holds.
  const at = tail.length - FooterTailBytes;

  const footerTail = Schema.decodeUnknownOption(FooterTail)(tail.subarray(at));

  if (Option.isNone(footerTail)) {
    return undefined;
  }

  const { footerLen, magic } = footerTail.value;

  // Any four bytes can precede the marker by accident, so a tail that ends
  // otherwise ends no file (section 4.1).
  if (!Magic.every((byte, index) => magic[index] === byte)) {
    return undefined;
  }

  const end = BigInt(FooterTailBytes + footerLen);

  return length < end ? undefined : length - end;
};

// Every frame states its length first as a varint, which takes at most ten bytes.
const FrameLengthBytes = 10;

// A region holds one frame per part, and a frame states its own length first, so a
// reader splits a region into the frames that tile it.
export const framesOf = (region: Uint8Array): ReadonlyArray<Uint8Array> | undefined => {
  const frames: Array<Uint8Array> = [];

  let at = 0;

  while (at < region.length) {
    let scale = 1;
    let length = 0;
    let end: number | undefined;

    for (let byte = at; byte < at + FrameLengthBytes && byte < region.length; byte += 1) {
      const value = region[byte]!;

      length += (value & 0x7f) * scale;

      if ((value & 0x80) === 0) {
        end = byte + 1 + length;

        break;
      }

      scale *= 128;
    }

    // A frame that runs past the region leaves the bytes before it unpaired.
    if (end === undefined || end > region.length) {
      return undefined;
    }

    frames.push(region.subarray(at, end));
    at = end;
  }

  return frames;
};
