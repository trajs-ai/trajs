import { DateTime, Effect, Schema, SchemaRepresentation, SchemaTransformation } from "effect";
import { SchemaBinary } from "effect/encoding";
import * as uuid from "uuid";

import { TrajectoryError } from "#/TrajectoryError.ts";

const bytes = (length: number) => Schema.Uint8Array.check(Schema.isBetweenLength(length, length));

export const Uuid = Schema.String.check(Schema.isUUID(7)).pipe(
  Schema.withConstructorDefault(Effect.sync(() => uuid.v7())),
);

export const UuidByte = bytes(16).pipe(
  Schema.withConstructorDefault(Effect.sync(() => uuid.parse(uuid.v7()))),
);

// Bytes become a string before `Uuid` checks them, so a value that is not a
// uuid v7 fails here too.
export const UuidFromByte = UuidByte.pipe(
  Schema.decodeTo(
    Uuid,
    SchemaTransformation.transform<string, Uint8Array>({
      decode: (bytes) => uuid.stringify(bytes),
      encode: (value) => uuid.parse(value),
    }),
  ),
);

export const TimestampString = Schema.DateTimeUtcFromString.pipe(
  Schema.withConstructorDefault(DateTime.now),
);

export const TimestampInt = Schema.DateTimeUtcFromMillis.pipe(
  Schema.withConstructorDefault(DateTime.now),
);

// A chunk's chain value and a file's digest are one value.
// It is the leading 8 bytes of the digest the header names.
// Eight bytes locate a broken or reordered chunk, and keep an append to the tail.
export const ChainBytes = 8;

export const Chain = bytes(ChainBytes);

/** The JSON document a schema states of itself. */
export const jsonDocument = (schema: Schema.Top): Schema.Json =>
  schema.pipe(Schema.toRepresentation, SchemaRepresentation.toJson);

/**
 * Throws where `schema` cannot be laid out as binary frames.
 *
 * Every part is written as binary frames. A declaration is a value, so the check
 * runs where the schema is declared rather than where a part first writes one,
 * and throws there because a declaration has no effect to fail in.
 */
export const requireBinaryLayout = (schema: Schema.Constraint): void => {
  try {
    SchemaBinary.toCodec(schema);
  } catch (cause) {
    throw TrajectoryError.binaryLayout(cause);
  }
};
