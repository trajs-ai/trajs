import { Compression } from "@trajs/utils";
import { Effect, Option, Schema } from "effect";

import type * as Config from "#/Config.ts";
import * as chunk from "#/internal/exchange/chunk.ts";
import * as frame from "#/internal/exchange/frame.ts";
import * as Trajectory from "#/Trajectory.ts";
import { TrajectoryError } from "#/TrajectoryError.ts";

/** The bytes of one stored trajectory, read by region. */
export interface Bytes {
  readonly size: bigint;
  readonly read: (position: bigint, size: number) => Effect.Effect<Uint8Array, TrajectoryError>;
}

/** One chunk the footer's table states: where it begins, how many bytes it takes, and the parts it holds. */
interface TableEntry {
  readonly at: bigint;
  readonly len: number;
  readonly index: number;
  readonly count: number;
}

/** The chunks a file holds, read from the footer's table and placed where each begins. */
const readTable = (bytes: Bytes): Effect.Effect<ReadonlyArray<TableEntry>, TrajectoryError> =>
  Effect.gen(function* () {
    const tailBytes = BigInt(chunk.FooterTailBytes);
    const noFooter = TrajectoryError.parse(new Error("the bytes end in no footer"));

    if (bytes.size < tailBytes) {
      return yield* Effect.fail(noFooter);
    }

    const tail = yield* bytes.read(bytes.size - tailBytes, chunk.FooterTailBytes);
    const start = chunk.footerStart(bytes.size, tail);

    if (start === undefined) {
      return yield* Effect.fail(noFooter);
    }

    const footer = yield* Schema.decodeUnknownEffect(chunk.Footer)(
      yield* bytes.read(start, Number(bytes.size - start - tailBytes)),
    ).pipe(Effect.mapError(TrajectoryError.parse));

    // The table states each chunk's size, so summing it back from the footer ends where
    // the first chunk begins.
    const total = footer.chunks.reduce((sum, entry) => sum + BigInt(entry.len), 0n);

    let at = start - total;
    let index = 0;

    return footer.chunks.map(({ len, count }) => {
      const entry = { at, len, index, count };

      at += BigInt(len);
      index += count;

      return entry;
    });
  });

/** The parts of a stored trajectory, read by index. */
export const makeBuffer = <C extends Config.AnyConfig>(config: C) =>
  Effect.gen(function* () {
    const compression = yield* Compression.Compression;
    const decodeFrame = frame.decodeFrame(config);

    // One chunk's two regions, split into the frames that tile them.
    const readFrames = (bytes: Bytes, entry: TableEntry) =>
      Effect.gen(function* () {
        const stored = yield* Schema.decodeUnknownEffect(chunk.Chunk)(
          yield* bytes.read(entry.at, entry.len),
        ).pipe(Effect.mapError(TrajectoryError.parse));

        const body =
          stored.compression === Compression.Algorithm.enums.None
            ? stored.body
            : yield* compression
                .decompressBytes({ algorithm: stored.compression })(stored.body)
                .pipe(Effect.mapError(TrajectoryError.parse));

        // Both regions hold the frames of one chunk, so they hold as many as each other.
        const metas = chunk.splitFrames(stored.meta);
        const regions = chunk.splitFrames(body);

        if (metas === undefined || regions === undefined || metas.length !== regions.length) {
          return yield* Effect.fail(
            TrajectoryError.parse(new Error("a chunk holds no whole frames")),
          );
        }

        return regions.map((region, frame) => ({ meta: metas[frame]!, body: region }));
      });

    return (
      bytes: Bytes,
    ): Effect.Effect<
      Trajectory.TrajectoryBuffer<C, TrajectoryError, Config.DecodingServices<C>>,
      TrajectoryError,
      Config.DecodingServices<C>
    > =>
      Effect.gen(function* () {
        const table = yield* readTable(bytes);

        const at = (index: number) =>
          Effect.gen(function* () {
            const found = table.findIndex(
              (entry) => index >= entry.index && index < entry.index + entry.count,
            );

            if (found === -1) {
              return Option.none();
            }

            const entry = table[found]!;
            const frames = yield* readFrames(bytes, entry);

            return Option.some(yield* decodeFrame(frames[index - entry.index]!));
          });

        return { length: table.reduce((sum, entry) => sum + entry.count, 0), at };
      });
  });
