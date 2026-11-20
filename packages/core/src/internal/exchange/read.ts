import { Bytes, Compression } from "@trajs/utils";
import { Effect, Option, Schema } from "effect";

import type * as Config from "#/Config.ts";
import * as chunk from "#/internal/exchange/chunk.ts";
import * as frame from "#/internal/exchange/frame.ts";
import * as Trajectory from "#/Trajectory.ts";
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

/** The chunks a file holds, and where the first of them begins. */
const readTable = <E, R>(sequence: Bytes.Bytes<E, R>, size: bigint) =>
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

    return { begin: place.start - total, chunks: footer.chunks };
  });

/** The parts of a stored trajectory a sequence of bytes holds, read by index. */
export const makeBuffer = <C extends Config.AnyConfig>(config: C) =>
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
      Trajectory.TrajectoryBuffer<C, TrajectoryError, Config.DecodingServices<C> | R>,
      TrajectoryError,
      R
    > =>
      Effect.gen(function* () {
        const size = yield* sequence.length.pipe(Effect.mapError(TrajectoryError.parse));
        const table = yield* readTable(sequence, size);

        const at = (index: number) =>
          Effect.gen(function* () {
            let position = table.begin;
            let seen = 0;

            for (const entry of table.chunks) {
              if (index < seen + entry.count) {
                const frames = yield* readFrames(sequence, position, entry.len);

                return Option.some(yield* decodeFrame(frames[index - seen]!));
              }

              seen += entry.count;
              position += BigInt(entry.len);
            }

            return Option.none();
          });

        return { length: table.chunks.reduce((sum, entry) => sum + entry.count, 0), at };
      });
  });
