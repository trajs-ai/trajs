/**
 * What a part of a trajectory contributes to a count, before a tokenizer counts
 * it.
 *
 * The estimate follows `ai-tokenizer`'s `sdk.ts`: a part contributes the text it
 * carries, a tool call contributes its name and the JSON of its parameters, a
 * tool result contributes its identifier and its result, and a payload that is
 * not text contributes a fixed estimate. The overheads a model's own token
 * configuration adds — the base overhead of a request, a per-message or
 * per-tool overhead, the content multiplier, and the cost of a tool's schema —
 * are not part of it, because trajs produces no such configuration.
 *
 * Every contribution is attributed to a kind, and the kinds partition a part's
 * count: text and reasoning are their own text, a tool call is its name and
 * parameters, a tool result is its identifier and its result, and a payload that
 * is not text is a fixed estimate. The kinds are the buckets a prompt's count
 * states, and what a tool result's count pairs with — see `Counted`.
 *
 * Text is what a tokenizer can actually answer for. A payload that is not text is
 * only estimated, because what it costs is a property of the model that reads it
 * and of the payload's own pixels, not of the tokenizer: the rule a caller names
 * decides, and `media.ts` holds the families.
 */

import { Predicate } from "effect";
import { Prompt } from "effect/ai";

import { imageSize } from "#/internal/image.ts";
import type { MediaRule } from "#/internal/media.ts";
import type {
  CountedPart,
  PromptPart,
  ResponseContentPart,
  ResponsePart,
} from "#/internal/part.ts";

/**
 * The kinds of information a count is attributed to, which are the buckets a
 * prompt's count states.
 *
 * A kind is named the way the datum states it rather than the way a message part
 * names it, so a `tool-call` part contributes to `toolCall` and a `file` part —
 * the one kind that is priced by a rule rather than the tokenizer — to `media`.
 */
export interface KindTokens {
  /** Tokens the text of a part is worth. */
  readonly text: number;
  /** Tokens the reasoning of a part is worth. */
  readonly reasoning: number;
  /** Tokens the calls of a part are worth: each name and the JSON of its parameters. */
  readonly toolCall: number;
  /** Tokens the results of a part are worth: each identifier and its result. */
  readonly toolResult: number;
  /** Tokens a rule priced for a payload that is not text, which a `file` carries. */
  readonly media: number;
}

/** The name of one of the kinds a count is attributed to. */
export type CountKind = keyof KindTokens;

/**
 * What one contribution to a part's count is: text to count under a tokenizer,
 * or a fixed estimate for a payload that is not text.
 *
 * A contribution of a tool call carries the call's `id`, so that what one call
 * is worth is known rather than only the total of every call a part carries — a
 * tool result pairs with the call it answers by that id.
 */
export type Contribution =
  | { readonly kind: CountKind; readonly text: string; readonly call?: string }
  | { readonly kind: CountKind; readonly estimate: number };

/**
 * The kinds of message part a count takes from, as `PartTag` accepts them.
 *
 * The kinds that carry meta information instead — the approval of a tool call,
 * the source of a response, its metadata and its finish — hold nothing a
 * tokenizer answers for, so a count is not taken from them and a trajectory is
 * not annotated by them.
 */
export const contentTags = ["text", "reasoning", "tool-call", "tool-result", "file"] as const;

/**
 * A kind of message part a count can be taken from.
 *
 * These are the kinds a trajectory is annotated by, so what a caller names is the
 * content it wants an estimate for rather than the kind of part carrying it.
 */
export type PartTag = (typeof contentTags)[number];

/** The kind of every message part a prompt message or a response part declares. */
type AnyPartTag = Prompt.Part["type"] | ResponseContentPart["type"];

/** Whether a kind carries content rather than meta information. */
const isContentTag = (tag: AnyPartTag): tag is PartTag =>
  contentTags.some((content) => content === tag);

/**
 * The kind the message parts of a given tag contribute to.
 *
 * A part is tagged the way `effect/ai` tags it and the count is bucketed the way
 * the datum states it, so the two are mapped rather than spelled alike.
 */
const kindByTag: Record<PartTag, CountKind> = {
  text: "text",
  reasoning: "reasoning",
  "tool-call": "toolCall",
  "tool-result": "toolResult",
  file: "media",
};

/** The JSON text of a payload, or nothing when the payload is absent. */
const jsonText = <Payload>(payload: Payload): string | undefined =>
  Predicate.isNullish(payload) ? undefined : JSON.stringify(payload);

/** The text of a payload: a string as it is, anything else as JSON. */
const payloadText = <Payload>(payload: Payload): string | undefined =>
  Predicate.isString(payload) ? payload : jsonText(payload);

/** The parts one message carries, a system message's content being its text. */
const messageContent = (message: Prompt.Message): ReadonlyArray<Prompt.Part> =>
  message.role === "system"
    ? [Prompt.makePart("text", { text: message.content })]
    : message.content;

/**
 * The kinds of content a part of a trajectory carries.
 *
 * A response part is one message part itself, so it carries its own kind.
 */
const partTags = (part: CountedPart): ReadonlyArray<PartTag> =>
  Predicate.isTagged("Prompt")(part)
    ? part.messages.flatMap((message) =>
        messageContent(message)
          .map((content) => content.type)
          .filter(isContentTag),
      )
    : [part.response.type].filter(isContentTag);

/** Whether a part carries a message part of one of the given kinds. */
export const carriesAnyTag = (part: CountedPart, tags: ReadonlyArray<PartTag>): boolean =>
  partTags(part).some((tag) => tags.includes(tag));

/**
 * The contributions of the texts one part carries, attributed to one kind and,
 * for the texts of a tool call, to that call.
 */
const textContributions = (
  kind: CountKind,
  texts: ReadonlyArray<string | undefined>,
  call?: string,
): ReadonlyArray<Contribution> =>
  texts.flatMap((text) =>
    text === undefined ? [] : [call === undefined ? { kind, text } : { kind, text, call }],
  );

/**
 * What one content part contributes, whether it is a part of a message a model
 * was given or a part the model returned: the two are the same kinds of content,
 * so they are estimated by the same rules.
 *
 * Reasoning is counted like text; this is the one rule `ai-tokenizer` does not
 * state, because the messages it counts have no reasoning part.
 */
const contentContributions = (
  part: Prompt.Part | ResponseContentPart,
  media: MediaRule,
): ReadonlyArray<Contribution> => {
  if (!isContentTag(part.type)) return [];

  const kind = kindByTag[part.type];

  switch (part.type) {
    case "text":
    case "reasoning":
      return textContributions(kind, [part.text]);
    case "tool-call":
      return textContributions(kind, [part.name, jsonText(part.params)], part.id);
    case "tool-result":
      return textContributions(kind, [part.id, payloadText(part.result)]);
    case "file":
      return [{ kind, estimate: media(part, imageSize(part.data)) }];
  }
};

/** What one message contributes: what each part it carries contributes. */
const messageContributions = (
  message: Prompt.Message,
  media: MediaRule,
): ReadonlyArray<Contribution> =>
  messageContent(message).flatMap((content) => contentContributions(content, media));

/** What a prompt part contributes: the content of each of its messages. */
const promptContributions = (part: PromptPart, media: MediaRule): ReadonlyArray<Contribution> =>
  part.messages.flatMap((message) => messageContributions(message, media));

/** What a response part contributes: what the one part it carries contributes. */
const responseContributions = (part: ResponsePart, media: MediaRule): ReadonlyArray<Contribution> =>
  contentContributions(part.response, media);

/**
 * What a part of a trajectory contributes.
 *
 * The role of a message is not counted: it is framing a provider adds around
 * what was said rather than information the trajectory holds, so the kinds
 * partition what a prompt carries without a bucket for it.
 */
export const partContributions = (
  part: CountedPart,
  media: MediaRule,
): ReadonlyArray<Contribution> =>
  Predicate.isTagged("Prompt")(part)
    ? promptContributions(part, media)
    : responseContributions(part, media);
