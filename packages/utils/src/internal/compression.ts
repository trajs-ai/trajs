/** The frames a compression carries, from the options of one call and the codec of a platform. */

import { Effect, Stream } from "effect";

import { concat } from "#/Byte.ts";
import {
  Algorithm,
  type Codec,
  type Compression,
  type CompressionError,
  type Options,
  defaultAlgorithm,
} from "#/Compression.ts";

/** Carries the chunks of a stream through the codec of the stated algorithm. */
const carryStream =
  (codecs: Codec["compress"]): Compression["compress"] =>
  (options) =>
  <E, R>(
    bytes: Stream.Stream<Uint8Array, E, R>,
  ): Stream.Stream<Uint8Array, E | CompressionError, R> => {
    const algorithm = options?.algorithm ?? defaultAlgorithm;

    // `None` states no codec, so the chunks are passed through untouched.
    return algorithm === Algorithm.enums.None ? bytes : codecs(algorithm)(bytes);
  };

/**
 * Carries the one buffer that is given through the frame of one call.
 *
 * The stream holds that buffer alone, so the codec writes or reads exactly one
 * frame.
 */
const carryBytes =
  (frame: Compression["compress"]) =>
  (options?: Options) =>
  (bytes: Uint8Array): Effect.Effect<Uint8Array, CompressionError> =>
    Stream.make(bytes).pipe(frame(options), Stream.runCollect, Effect.map(concat));

/** The compression a platform's codecs provide. */
export const makeCompression = (codec: Codec): Compression => {
  const compress = carryStream(codec.compress);
  const decompress = carryStream(codec.decompress);

  return {
    compress,
    compressBytes: carryBytes(compress),
    decompress,
    decompressBytes: carryBytes(decompress),
  };
};
