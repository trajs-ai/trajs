/** The bytes of one message, read into the span of each field and written back out in wire order. */

import { Effect } from "effect";
import type { SchemaIssue } from "effect";

import { concat } from "#/Bytes.ts";
import {
  fieldSpan,
  missingFrame,
  missingValue,
  runSpan,
  spanShortfall,
  trailingBytes,
} from "#/internal/binary-protocol/binary-issue.ts";
import { readFrameLength } from "#/internal/binary-protocol/frame.ts";
import type { Counted, Slot, Spans } from "#/internal/binary-protocol/layout.ts";
import { readNumber } from "#/internal/binary-protocol/wire-integer.ts";

/** The number of bytes the field a run of bytes is counted by states. */
const countedLength = (counted: Counted, spans: Spans): number => {
  // A layout states the field a run is counted by before the run, so its span is
  // among those read already.
  return readNumber(spans[counted.field]!, counted.width);
};

/** The bytes the fields of a layout span in one message. */
export const readFields = (
  slots: ReadonlyArray<Slot>,
  bytes: Uint8Array<ArrayBufferLike>,
): Effect.Effect<Spans, SchemaIssue.Issue> =>
  Effect.gen(function* () {
    const spans: Spans = {};
    let at = 0;

    for (const slot of slots) {
      const left = bytes.length - at;

      if (slot.kind === "integer") {
        if (left < slot.width) {
          return yield* Effect.fail(spanShortfall(slot.name, left, slot.width));
        }

        spans[slot.name] = bytes.subarray(at, at + slot.width);
        at += slot.width;

        continue;
      }

      if (slot.kind === "frame") {
        const size = readFrameLength(bytes, at);

        if (size === undefined) {
          return yield* Effect.fail(missingFrame(slot.name));
        }

        spans[slot.name] = bytes.subarray(at, at + size);
        at += size;

        continue;
      }

      const length = slot.kind === "bytes" ? slot.length : countedLength(slot.counted, spans);

      if (left < length) {
        return yield* Effect.fail(spanShortfall(slot.name, left, length));
      }

      spans[slot.name] = bytes.subarray(at, at + length);
      at += length;
    }

    // The layout states no field for the bytes left over, so they are not of the
    // message its fields describe.
    if (at !== bytes.length) {
      return yield* Effect.fail(trailingBytes(bytes.length - at));
    }

    return spans;
  });

/** The bytes the fields of a layout write for the values of one message. */
export const writeFields = (
  slots: ReadonlyArray<Slot>,
  spans: Spans,
): Effect.Effect<Uint8Array, SchemaIssue.Issue> =>
  Effect.gen(function* () {
    const chunks: Array<Uint8Array> = [];

    for (const slot of slots) {
      const span = spans[slot.name];

      if (span === undefined) {
        return yield* Effect.fail(missingValue(slot.name));
      }

      if (slot.kind === "bytes" && span.length !== slot.length) {
        return yield* Effect.fail(fieldSpan(slot.name, span.length, slot.length));
      }

      if (slot.kind === "counted") {
        const length = countedLength(slot.counted, spans);

        if (span.length !== length) {
          return yield* Effect.fail(runSpan(slot.name, span.length, slot.counted.field, length));
        }
      }

      if (slot.kind === "integer" && span.length !== slot.width) {
        return yield* Effect.fail(fieldSpan(slot.name, span.length, slot.width));
      }

      chunks.push(span);
    }

    return concat(chunks);
  });
