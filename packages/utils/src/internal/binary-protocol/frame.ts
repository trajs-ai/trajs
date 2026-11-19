/** The length `SchemaBinary` states at the head of a frame, in base 128. */

/** The most bytes the length of a frame takes. */
const LengthBytes = 10;

/**
 * How many bytes the frame at `offset` spans, or nothing where the bytes there
 * hold no whole frame.
 */
export const readFrameLength = (bytes: Uint8Array, offset: number): number | undefined => {
  let scale = 1;
  let length = 0;

  for (let at = offset; at < offset + LengthBytes && at < bytes.length; at += 1) {
    const byte = bytes[at]!;

    length += (byte & 0x7f) * scale;

    if ((byte & 0x80) === 0) {
      const size = at + 1 - offset + length;

      return offset + size > bytes.length ? undefined : size;
    }

    scale *= 128;
  }

  return undefined;
};
