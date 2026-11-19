/**
 * Counts what the contributions of a part of a trajectory are worth under a
 * tokenizer.
 *
 * Text becomes the tokens the tokenizer gives it, and a rule's estimate is added
 * as it is. The two are kept apart in {@link Counted}, so that an estimate can
 * state how much of its count a rule priced rather than the tokenizer.
 *
 * The tokenizer is read from the run rather than taken as an argument, so which
 * one a count is taken with is chosen where the run is provided with a layer.
 */

import { Effect } from "effect";
import { Tokenizer } from "effect/ai";
import type { AiError } from "effect/ai";

import { type Contribution, type KindTokens, partContributions } from "#/internal/contribution.ts";
import type { MediaRule } from "#/internal/media.ts";
import type { CountedPart } from "#/internal/part.ts";

/** What one tool call a part carries is worth, and which call it is. */
export interface CallCount {
  /** Identifier of the call, which a tool result answers. */
  readonly id: string;
  /** Tokens the call is worth: its name and the JSON of its parameters. */
  readonly tokens: number;
}

/**
 * A part's estimated tokens, split by how each of them is estimated: the total,
 * the kind of information each of them came from, and what each call the part
 * carries is worth on its own.
 */
export interface Counted {
  /** Estimated tokens of the whole part. */
  readonly tokens: number;
  /**
   * Of those, the tokens a rule on a payload that is not text priced rather than
   * the tokenizer.
   */
  readonly mediaTokens: number;
  /** Of those, the tokens of each kind of information the part carries. */
  readonly kinds: KindTokens;
  /** What each tool call the part carries is worth, by the call's identifier. */
  readonly calls: ReadonlyArray<CallCount>;
}

/**
 * Counts what the contributions of a part are worth: each one is attributed to
 * its kind, and one of a tool call is summed per call as well.
 *
 * A contribution a rule estimated is added as it is, so the count a part states
 * can tell how much of it a rule priced rather than the tokenizer.
 */
export const countContributions = (
  contributions: ReadonlyArray<Contribution>,
): Effect.Effect<Counted, AiError.AiError, Tokenizer.Tokenizer> =>
  Effect.gen(function* () {
    const tokenizer = yield* Tokenizer.Tokenizer;
    const kinds = { text: 0, reasoning: 0, toolCall: 0, toolResult: 0, media: 0 };
    const calls = new Map<string, number>();

    let tokens = 0;

    for (const contribution of contributions) {
      const counted =
        "text" in contribution
          ? (yield* tokenizer.tokenize(contribution.text)).length
          : contribution.estimate;

      tokens += counted;
      kinds[contribution.kind] += counted;

      const call = "call" in contribution ? contribution.call : undefined;

      if (call !== undefined) calls.set(call, (calls.get(call) ?? 0) + counted);
    }

    return {
      tokens,
      mediaTokens: kinds.media,
      kinds,
      calls: Array.from(calls, ([id, counted]) => ({ id, tokens: counted })),
    };
  });

/** Counts what one part of a trajectory contributes, under one rule. */
export const countPart = (
  part: CountedPart,
  media: MediaRule,
): Effect.Effect<Counted, AiError.AiError, Tokenizer.Tokenizer> =>
  countContributions(partContributions(part, media));
