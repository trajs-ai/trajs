import { Option, Predicate } from "effect";
import type { Tool } from "effect/ai";

import * as Response from "#/Response.ts";

/** A text or reasoning chunk that a response has opened and not yet ended. */
interface Chunk {
  text: string;
  metadata: Response.ProviderMetadata;
}

/** The open chunks of one session, by the id of the part that opened them. */
type Chunks = Map<string, Map<string, Chunk>>;

/**
 * The text and reasoning chunks a response has opened, by session and by chunk id.
 *
 * A chunk is opened by the part that starts it, added to by its deltas, and closed
 * by the part that ends it, which is the part the chunk is written as.
 */
export interface State {
  readonly text: Chunks;
  readonly reasoning: Chunks;
}

/** The state before a response has opened a chunk. */
export const initial = (): State => ({ text: new Map(), reasoning: new Map() });

/** The chunks `session` opened, opened where it has none yet. */
const openChunks = (chunks: Chunks, session: string): Map<string, Chunk> => {
  let open = chunks.get(session);

  if (open === undefined) {
    open = new Map();
    chunks.set(session, open);
  }

  return open;
};

const mergeMetadata = (
  left: Response.ProviderMetadata,
  right: Response.ProviderMetadata,
): Response.ProviderMetadata => {
  const merged = { ...left };

  for (const [provider, metadata] of Object.entries(right)) {
    const previous = merged[provider];

    merged[provider] =
      Predicate.isObject(previous) && Predicate.isObject(metadata)
        ? Object.assign({}, previous, metadata)
        : metadata;
  }

  return merged;
};

/** The parts that open, extend, or end a text or reasoning chunk. */
type ChunkPart =
  | Response.TextStartPart
  | Response.TextDeltaPart
  | Response.TextEndPart
  | Response.ReasoningStartPart
  | Response.ReasoningDeltaPart
  | Response.ReasoningEndPart;

/** What a closed chunk is written as. */
type ChunkKind = "text" | "reasoning";

/**
 * Folds one part of a chunk into the chunk it belongs to.
 *
 * Returns the part the chunk is written as once it ends, and none before.
 */
const foldChunk = <Tools extends Record<string, Tool.Any>>(
  chunks: Chunks,
  kind: ChunkKind,
  session: string,
  part: ChunkPart,
): Option.Option<Response.PartView<Tools>> => {
  const open = openChunks(chunks, session);

  if (part.type === "text-start" || part.type === "reasoning-start") {
    open.set(part.id, { text: "", metadata: part.metadata });

    return Option.none();
  }

  const chunk = open.get(part.id);

  if (chunk === undefined) {
    return Option.none();
  }

  if (part.type === "text-delta" || part.type === "reasoning-delta") {
    chunk.text += part.delta;
    chunk.metadata = mergeMetadata(chunk.metadata, part.metadata);

    return Option.none();
  }

  open.delete(part.id);

  return Option.some(
    Response.makePart(kind, {
      text: chunk.text,
      metadata: mergeMetadata(chunk.metadata, part.metadata),
    }),
  );
};

/**
 * Folds one part into the finished part it belongs to.
 *
 * Returns none for an increment, and for a part a trajectory does not hold.
 */
export const foldResponse = <Tools extends Record<string, Tool.Any>>(
  state: State,
  session: string,
  part: Response.AllPartsView<Tools>,
): readonly [State, Option.Option<Response.PartView<Tools>>] => {
  switch (part.type) {
    case "text-start":
    case "text-delta":
    case "text-end":
      return [state, foldChunk(state.text, "text", session, part)];

    case "reasoning-start":
    case "reasoning-delta":
    case "reasoning-end":
      return [state, foldChunk(state.reasoning, "reasoning", session, part)];

    case "tool-params-start":
    case "tool-params-delta":
    case "tool-params-end":
    case "error":
      return [state, Option.none()];

    default:
      return [state, Option.some(part)];
  }
};
