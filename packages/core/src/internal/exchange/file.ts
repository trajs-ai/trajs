import { Compression } from "@trajs/utils";
import { Effect, Option, Schema } from "effect";

import type * as Config from "#/Config.ts";
import * as chunk from "#/internal/exchange/chunk.ts";
import * as part from "#/internal/exchange/part.ts";
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

// The table a file ends with, summed back from the footer to where the first chunk begins.
const tableOf = (bytes: Bytes): Effect.Effect<ReadonlyArray<TableEntry>, TrajectoryError> =>
  Effect.gen(function* () {
    const tailBytes = BigInt(chunk.FooterTailBytes);
    const noFooter = TrajectoryError.parse(new Error("the bytes end in no footer"));

    if (bytes.size < tailBytes) {
      return yield* Effect.fail(noFooter);
    }

    const tail = yield* bytes.read(bytes.size - tailBytes, chunk.FooterTailBytes);
    const start = chunk.footerStartOf(bytes.size, tail);

    if (start === undefined) {
      return yield* Effect.fail(noFooter);
    }

    const footer = yield* Schema.decodeUnknownEffect(chunk.Footer)(
      yield* bytes.read(start, Number(bytes.size - start - tailBytes)),
    ).pipe(Effect.mapError(TrajectoryError.parse));

    // The table states each chunk's size, so summing it back from the footer ends where
    // the first chunk begins.
    const table: Array<TableEntry> = [];

    let index = 0;
    let position = footer.chunks.reduce((sum, entry) => sum - BigInt(entry.len), start);

    for (const entry of footer.chunks) {
      table.push({ at: position, len: entry.len, index, count: entry.count });

      position += BigInt(entry.len);
      index += entry.count;
    }

    return table;
  });

// One chunk's two regions, split into the frames that tile them.
const framesOf = (bytes: Bytes, compression: Compression.Compression) => (entry: TableEntry) =>
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
    const metas = chunk.framesOf(stored.meta);
    const regions = chunk.framesOf(body);

    if (metas === undefined || regions === undefined || metas.length !== regions.length) {
      return yield* Effect.fail(TrajectoryError.parse(new Error("a chunk holds no whole frames")));
    }

    return regions.map((region, frame) => ({ meta: metas[frame]!, body: region }));
  });

// The parts of a stored trajectory, read by index.
export const bufferOf =
  <C extends Config.AnyConfig>(config: C, compression: Compression.Compression) =>
  (
    bytes: Bytes,
  ): Effect.Effect<
    Trajectory.TrajectoryBuffer<C, TrajectoryError, Config.DecodingServices<C>>,
    TrajectoryError,
    Config.DecodingServices<C>
  > => {
    const decodeFrame = part.decodeFrame(config);

    return Effect.gen(function* () {
      const table = yield* tableOf(bytes);

      const at = (index: number) =>
        Effect.gen(function* () {
          const found = table.findIndex(
            (entry) => index >= entry.index && index < entry.index + entry.count,
          );

          if (found === -1) {
            return Option.none();
          }

          const entry = table[found]!;
          const frames = yield* framesOf(bytes, compression)(entry);

          return Option.some(yield* decodeFrame(frames[index - entry.index]!));
        });

      return { length: table.reduce((sum, entry) => sum + entry.count, 0), at };
    });
  };
