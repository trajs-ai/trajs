/**
 * What a content a document states says, and the bytes it names.
 *
 * A run of text parts is one piece, since what a trajectory states is what was said
 * rather than how the producer split it up.
 */

import { Effect, FileSystem, Path, Predicate } from "effect";
import type { PlatformError } from "effect";

import type { Content } from "#/unstable/atif/Document.ts";

/** The services the reading runs on: the files it serves, and the paths it resolves. */
export type Services = FileSystem.FileSystem | Path.Path;

/** A run of text a content states, or the bytes of one medium it holds. */
export type Piece =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "file";
      readonly mediaType: string;
      readonly data: Uint8Array;
      /** The seconds the recording lasts, where the document states one. */
      readonly duration: number | undefined;
    };

/** The text a content states, read without the media it holds. */
export const contentText = (content: Content): string => {
  if (Predicate.isString(content)) return content;

  let text = "";

  for (const part of content) {
    if (part.type === "text") text += part.text;
  }

  return text;
};

/**
 * The pieces a content states, in the order it states them.
 *
 * The bytes are read through the file system under the directory the reading is given.
 */
export const readPieces = (
  content: Content,
  cwd: string | undefined,
): Effect.Effect<ReadonlyArray<Piece>, PlatformError.PlatformError, Services> =>
  Effect.gen(function* () {
    if (Predicate.isString(content)) return [{ kind: "text", text: content }];

    const fs = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;

    // A path is read under the directory the reading is given where it is relative, and as
    // it is stated where it is absolute or no directory is given.
    const readPath = (stated: string): string =>
      cwd === undefined || paths.isAbsolute(stated) ? stated : paths.join(cwd, stated);

    const pieces: Piece[] = [];
    let text = "";

    for (const part of content) {
      if (part.type === "text") {
        text += part.text;
        continue;
      }

      if (text !== "") {
        pieces.push({ kind: "text", text });
        text = "";
      }

      pieces.push({
        kind: "file",
        mediaType: part.source.media_type,
        data: yield* fs.readFile(readPath(part.source.path)),
        // A duration stated as null states none, as leaving it out does.
        duration: part.type === "audio" ? (part.source.duration_sec ?? undefined) : undefined,
      });
    }

    if (text !== "") pieces.push({ kind: "text", text });

    return pieces;
  });
