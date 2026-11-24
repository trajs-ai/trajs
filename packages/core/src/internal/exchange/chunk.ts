import { Bytes, Checksum, Compression, StreamHash } from "@trajs/utils";
import * as BinaryProtocol from "@trajs/utils/BinaryProtocol";
import type { CompressionError } from "@trajs/utils/Compression";
import { Effect, Option, Schema, Stream } from "effect";

import type * as Config from "#/Config.ts";
import * as EventKit from "#/EventKit.ts";
import * as ExtraKit from "#/ExtraKit.ts";
import type { Frame } from "#/internal/exchange/frame.ts";
import { ChainBytes, Uuid } from "#/internal/schema.ts";
import * as MetricKit from "#/MetricKit.ts";
import * as Toolkit from "#/Toolkit.ts";

/** The marker that begins every trajectory and ends every file, so it states no place of its own. */
export const Magic = new TextEncoder().encode("TRAJS");

/** The declarations a file states of the trajectory it holds. */
export interface Header {
  id: string;
  version: string;
  hash: StreamHash.Algorithm;
  toolkit: Toolkit.ToolkitSchema;
  eventkit: EventKit.EventKitSchema;
  metrickit: MetricKit.MetricKitSchema;
  extrakit: ExtraKit.ExtraKitSchema;
}

export const Header: Schema.Codec<Header> = Schema.Struct({
  id: Uuid,
  version: Schema.String,
  hash: StreamHash.Algorithm,
  toolkit: Toolkit.ToolkitSchema,
  eventkit: EventKit.EventKitSchema,
  metrickit: MetricKit.MetricKitSchema,
  extrakit: ExtraKit.ExtraKitSchema,
}).annotate({ identifier: "Header" });

/** The header a config's kits write for one trajectory. */
export const makeHeader = (
  config: Config.AnyConfig,
  {
    id,
    version,
    hash,
  }: {
    readonly id: string;
    readonly version: string;
    readonly hash: StreamHash.Algorithm;
  },
): Header => ({
  id,
  version,
  hash,
  toolkit: Toolkit.encode(config.toolkit),
  eventkit: EventKit.encode(config.eventkit),
  metrickit: MetricKit.encode(config.metrickit),
  extrakit: ExtraKit.encode(config.extrakit),
});

const headerHeadFields = {
  crc: BinaryProtocol.u32,
  len: BinaryProtocol.u32,
};

/**
 * A file begins with its header, which is no chunk and so states no body. The header
 * states how many bytes it takes, since no table holds its extent, and its chain value
 * extends the one {@link Magic} starts, so a reader checks it with no chunk before it.
 */
export const HeaderRegion = BinaryProtocol.layout({
  ...headerHeadFields,
  header: Header,
  chain: BinaryProtocol.bytes(ChainBytes),
});

export type HeaderRegion = Schema.Schema.Type<typeof HeaderRegion>;

/** What a scan reads of a header before the header states how many bytes it takes. */
export const HeaderHead = BinaryProtocol.layout(headerHeadFields);

export type HeaderHead = Schema.Schema.Type<typeof HeaderHead>;

/** Every field of a head is empty, so the codec states how many bytes a head takes. */
const HeaderHeadBytes = Schema.encodeSync(HeaderHead)({ crc: 0, len: 0 }).length;

/** The marker and the head of a header, which a scan reads first. */
export const HeaderStartBytes = Magic.length + HeaderHeadBytes;

const chunkHeaderFields = {
  metaCrc: BinaryProtocol.u32,
  bodyCrc: BinaryProtocol.u32,
  bodyLen: BinaryProtocol.u32,
  metaLen: BinaryProtocol.u32,
  compression: BinaryProtocol.u8.pipe(BinaryProtocol.decodeTo(Compression.Algorithm)),
};

/** `bodyCrc` covers the body region alone, so the chain value sits outside it. */
export const Chunk = BinaryProtocol.layout({
  ...chunkHeaderFields,
  meta: BinaryProtocol.bytes("metaLen"),
  body: BinaryProtocol.bytes("bodyLen"),
  chain: BinaryProtocol.bytes(ChainBytes),
});

export type Chunk = Schema.Schema.Type<typeof Chunk>;

/** What a scan reads alone, before it knows a chunk's extent. */
export const ChunkHeader = BinaryProtocol.layout(chunkHeaderFields);

export type ChunkHeader = Schema.Schema.Type<typeof ChunkHeader>;

/** The two `u32` checksums a header states first, so the bytes `metaCrc` covers begin after them. */
const ChecksumBytes = 8;

/** Every field is empty, so the codec states how many bytes a header takes. */
const ChunkHeaderBytes = Schema.encodeSync(ChunkHeader)({
  metaCrc: 0,
  bodyCrc: 0,
  bodyLen: 0,
  metaLen: 0,
  compression: Compression.Algorithm.enums.None,
}).length;

/** How many bytes a chunk takes, as the header it begins with states. */
export const chunkLength = (header: ChunkHeader): number =>
  ChunkHeaderBytes + ChainBytes + header.metaLen + header.bodyLen;

/**
 * Takes one whole chunk off the front of `bytes`. A truncated tail is a writer that
 * stopped inside a write, so it yields no chunk.
 */
export const takeChunk = (
  bytes: Uint8Array,
): { readonly chunk: Chunk; readonly rest: Uint8Array } | undefined => {
  const header = Schema.decodeUnknownOption(ChunkHeader)(bytes.subarray(0, ChunkHeaderBytes));

  if (Option.isNone(header)) {
    return undefined;
  }

  const len = chunkLength(header.value);

  if (len > bytes.length) {
    return undefined;
  }

  // The chunk is decoded whole, so its regions are the ones the header states.
  const chunk = Schema.decodeUnknownOption(Chunk)(bytes.subarray(0, len));

  return Option.isNone(chunk) ? undefined : { chunk: chunk.value, rest: bytes.subarray(len) };
};

/**
 * The chain value that extends `prev` over `bytes`. A trajectory starts from
 * {@link Magic}, so its first value is `extendChain(hash, Magic)`.
 */
export const extendChain = (
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

/** The chain value extends over the chunk through its body, and sits after it. */
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

    const meta = Bytes.concat(frames.map((frame) => frame.meta));
    const bodies = Bytes.concat(frames.map((frame) => frame.body));

    const packed = yield* compression.compressBytes({ algorithm })(bodies);

    // A region the codec does not make smaller is stored unwrapped.
    const smaller = packed.length < bodies.length;

    const body = smaller ? packed : bodies;
    const code = smaller ? algorithm : Compression.Algorithm.enums.None;
    const bodyLen = body.length;

    // A length beyond a `u32` is refused where a part is accepted.
    const metaLen = meta.length;
    const crc = checksum.of({ algorithm: Checksum.Algorithm.enums.Crc32 });

    // A checksum sits before the bytes it covers, so the header is laid out twice:
    // once with both checksums zero, and once with them read.
    const header = { metaCrc: 0, bodyCrc: 0, bodyLen, metaLen, compression: code };
    const headerBytes = Schema.encodeSync(ChunkHeader)(header);

    // `metaCrc` covers the header past its two checksums, and the meta region.
    const afterChecksums = headerBytes.subarray(ChecksumBytes);
    const metaCrc = crc(Bytes.concat([afterChecksums, meta]));

    const bodyCrc = crc(body);

    const unchained = Bytes.concat([
      Schema.encodeSync(ChunkHeader)({ ...header, metaCrc, bodyCrc }),
      meta,
      body,
    ]);

    const chain = yield* extendChain(hash, prev, unchained);

    return Bytes.concat([unchained, chain]);
  });

/** Membership is decided on the raw size of frames, before they are compressed. */
export const DefaultChunkSize = 2 * 1024 * 1024;

/** The raw size a frame counts against a chunk's limit. */
const frameSize = (frame: Frame): number => frame.meta.length + frame.body.length;

/** The frames a chunk holds so far, and the raw size they take. */
interface OpenChunk {
  readonly held: Array<Frame>;
  readonly size: number;
}

/**
 * A chunk holds frames until the raw size would pass `chunkSize`, then closes before
 * that frame.
 */
export const chunkFrames =
  (chunkSize: number = DefaultChunkSize) =>
  <E, R>(frames: Stream.Stream<Frame, E, R>): Stream.Stream<ReadonlyArray<Frame>, E, R> =>
    frames.pipe(
      Stream.mapAccumArray(
        (): OpenChunk => ({ held: [], size: 0 }),
        ({ held, size }: OpenChunk, batch) => {
          const closed: Array<ReadonlyArray<Frame>> = [];

          let open = held;
          let taken = size;

          for (const frame of batch) {
            const raw = frameSize(frame);

            if (open.length > 0 && taken + raw > chunkSize) {
              closed.push(open);

              open = [];
              taken = 0;
            }

            open.push(frame);
            taken += raw;
          }

          return [{ held: open, size: taken }, closed] as const;
        },
        { onHalt: ({ held }) => (held.length === 0 ? [] : [held]) },
      ),
    );

/** One data chunk in file order: its whole size, the size of its meta region, and its frame count. */
const chunkEntry = Schema.Struct({
  len: Schema.Int,
  metaLen: Schema.Int,
  count: Schema.Int,
});

/** A footer is not a chunk, so nothing of it is a body. */
export const Footer = BinaryProtocol.layout({
  crc: BinaryProtocol.u32,
  chain: BinaryProtocol.bytes(ChainBytes),
  chunks: Schema.Array(chunkEntry),
});

export type Footer = Schema.Schema.Type<typeof Footer>;

/** `footerLen` and the marker end every file, so a locate reads them alone. */
export const FooterTail = BinaryProtocol.layout({
  footerLen: BinaryProtocol.u32,
  magic: BinaryProtocol.bytes(Magic.length),
});

export type FooterTail = Schema.Schema.Type<typeof FooterTail>;

export const FooterTailBytes = 4 + Magic.length;

/**
 * Where the footer begins and how many bytes it takes, or nothing where the bytes hold
 * no footer. A reader confirms the place against the file's own length.
 */
export const footerStart = (
  length: bigint,
  tail: Uint8Array,
): { readonly start: bigint; readonly len: number } | undefined => {
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
  // otherwise ends no file.
  if (!Magic.every((byte, index) => magic[index] === byte)) {
    return undefined;
  }

  const end = BigInt(FooterTailBytes + footerLen);

  return length < end ? undefined : { start: length - end, len: footerLen };
};

/**
 * The frames that tile a region, one per part. A frame states its own length first, so a
 * reader walks the region rather than decoding it.
 */
export const splitFrames = (region: Uint8Array): ReadonlyArray<Uint8Array> | undefined => {
  const frames: Array<Uint8Array> = [];

  let at = 0;

  while (at < region.length) {
    const length = BinaryProtocol.frameLength(region, at);

    // A frame that runs past the region leaves the bytes before it unpaired.
    if (length === undefined) {
      return undefined;
    }

    frames.push(region.subarray(at, at + length));
    at += length;
  }

  return frames;
};
