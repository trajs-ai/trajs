import { Bytes, Compression } from "@trajs/utils";
import { Effect, Option, Schema } from "effect";

import * as chunk from "#/internal/exchange/chunk.ts";
import * as frame from "#/internal/exchange/frame.ts";
import * as Trajectory from "#/Trajectory.ts";
import type * as TrajectoryConfig from "#/TrajectoryConfig.ts";
import { TrajectoryError } from "#/TrajectoryError.ts";

const corrupt = (message: string): TrajectoryError => TrajectoryError.parse(new Error(message));

/** The `size` bytes at `position`, taken from a sequence until all of them arrive. */
const readAt = <E, R>(
  sequence: Bytes.Bytes<E, R>,
  position: bigint,
  size: number,
): Effect.Effect<Uint8Array, TrajectoryError, R> =>
  Effect.gen(function* () {
    const held = new Uint8Array(size);

    let filled = 0;

    while (filled < size) {
      const taken = yield* sequence
        .read(held.subarray(filled), { offset: position + BigInt(filled) })
        .pipe(Effect.mapError(TrajectoryError.parse));

      if (taken === 0) {
        return yield* Effect.fail(
          corrupt(`the bytes end inside the region of ${size} bytes at ${position}`),
        );
      }

      filled += taken;
    }

    return held;
  });

/** The footer of a stored file, and where the first of its chunks begins. */
export const readFooter = <E, R>(sequence: Bytes.Bytes<E, R>, size: bigint) =>
  Effect.gen(function* () {
    const tailBytes = BigInt(chunk.FooterTailBytes);
    const noFooter = corrupt("the bytes end in no footer");

    if (size < tailBytes) {
      return yield* Effect.fail(noFooter);
    }

    const tail = yield* readAt(sequence, size - tailBytes, chunk.FooterTailBytes);
    const place = chunk.footerStart(size, tail);

    if (place === undefined) {
      return yield* Effect.fail(noFooter);
    }

    const footer = yield* Schema.decodeUnknownEffect(chunk.Footer)(
      yield* readAt(sequence, place.start, place.len),
    ).pipe(Effect.mapError(TrajectoryError.parse));

    // The table states each chunk's size, so summing it back from the footer ends where
    // the first chunk begins.
    const total = footer.chunks.reduce((sum, entry) => sum + BigInt(entry.len), 0n);

    if (total > place.start) {
      return yield* Effect.fail(
        corrupt(`the table states ${total} chunk bytes, and ${place.start} lie before the footer`),
      );
    }

    return { begin: place.start - total, footer };
  });

/**
 * The header at the head of a stored file, which states the trajectory it holds and the
 * kits it was written with. The header states how many bytes it takes, so no footer is
 * read here.
 */
export const readHeader = <E, R>(
  sequence: Bytes.Bytes<E, R>,
  size: bigint,
): Effect.Effect<chunk.Header, TrajectoryError, R> =>
  Effect.gen(function* () {
    const noHeader = corrupt("the bytes begin in no header");

    const startBytes = BigInt(chunk.HeaderStartBytes);
    const start = yield* readAt(sequence, 0n, Number(size < startBytes ? size : startBytes));

    if (!chunk.Magic.every((byte, index) => start[index] === byte)) {
      return yield* Effect.fail(noHeader);
    }

    const head = yield* Schema.decodeUnknownEffect(chunk.HeaderHead)(
      start.subarray(chunk.Magic.length),
    ).pipe(Effect.mapError(TrajectoryError.parse));

    // The head states the bytes the header takes, so the region is read from that alone.
    const regionBytes = BigInt(chunk.Magic.length) + BigInt(head.len);

    if (size < regionBytes) {
      return yield* Effect.fail(noHeader);
    }

    const region = yield* readAt(sequence, 0n, Number(regionBytes));

    const decoded = yield* Schema.decodeUnknownEffect(chunk.HeaderRegion)(
      region.subarray(chunk.Magic.length),
    ).pipe(Effect.mapError(TrajectoryError.parse));

    return decoded.header;
  });

/** The parts of a stored trajectory a sequence of bytes holds, read by index. */
export const makeBuffer = <C extends TrajectoryConfig.AnyConfig>(config: C) =>
  Effect.gen(function* () {
    const compression = yield* Compression.Compression;
    const decodeFrame = frame.decodeFrame(config);

    const readFrames = <E, R>(sequence: Bytes.Bytes<E, R>, at: bigint, len: number) =>
      Effect.gen(function* () {
        const stored = yield* Schema.decodeUnknownEffect(chunk.Chunk)(
          yield* readAt(sequence, at, len),
        ).pipe(Effect.mapError(TrajectoryError.parse));

        const body =
          stored.compression === Compression.Algorithm.enums.None
            ? stored.body
            : yield* compression
                .decompressBytes({ algorithm: stored.compression })(stored.body)
                .pipe(Effect.mapError(TrajectoryError.parse));

        const metas = chunk.splitFrames(stored.meta);
        const regions = chunk.splitFrames(body);

        if (metas === undefined) {
          return yield* Effect.fail(corrupt("the meta region of a chunk ends inside a frame"));
        }

        if (regions === undefined) {
          return yield* Effect.fail(corrupt("the body region of a chunk ends inside a frame"));
        }

        // Both regions hold the frames of one chunk, so they hold as many as each other.
        if (metas.length !== regions.length) {
          return yield* Effect.fail(
            corrupt(`a chunk holds ${metas.length} meta frames and ${regions.length} body frames`),
          );
        }

        return regions.map((region, index) => ({ meta: metas[index]!, body: region }));
      });

    return <E, R>(
      sequence: Bytes.Bytes<E, R>,
    ): Effect.Effect<
      Trajectory.TrajectoryBuffer<C, TrajectoryError, TrajectoryConfig.DecodingServices<C> | R>,
      TrajectoryError,
      R
    > =>
      Effect.gen(function* () {
        const size = yield* sequence.length.pipe(Effect.mapError(TrajectoryError.parse));
        const { begin, footer } = yield* readFooter(sequence, size);

        const chunks = footer.chunks;

        const at = (index: number) =>
          Effect.gen(function* () {
            let position = begin;
            let seen = 0;

            for (const entry of chunks) {
              if (index < seen + entry.count) {
                const frames = yield* readFrames(sequence, position, entry.len);

                return Option.some(yield* decodeFrame(frames[index - seen]!));
              }

              seen += entry.count;
              position += BigInt(entry.len);
            }

            return Option.none();
          });

        return { length: chunks.reduce((sum, entry) => sum + entry.count, 0), at };
      });
  });
