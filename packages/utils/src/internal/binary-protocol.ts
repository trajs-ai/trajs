import { Schema } from "effect";

/** The value schema of an unsigned integer field, up to `maximum`. */
export const unsigned = (maximum: number) =>
  Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(maximum));
