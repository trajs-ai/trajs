/**
 * The parts a step is read as: the message a turn opens with, and what the agent
 * answered that turn with, its results included.
 */

import { Effect } from "effect";
import type { PlatformError } from "effect";

import type * as Extra from "#/Extra.ts";
import * as Prompt from "#/Prompt.ts";
import * as Response from "#/Response.ts";
import type { StepObject } from "#/unstable/atif/Document.ts";
import {
  callExtra,
  CallFields,
  extrakit,
  resultExtra,
  ResultFields,
} from "#/unstable/atif/Extra.ts";
import { contentText, readPieces } from "#/unstable/atif/internal/content.ts";
import type { Services } from "#/unstable/atif/internal/content.ts";
import { mediaExtraRecord } from "#/unstable/atif/internal/fields.ts";

/** A response part the reading produces, and the extra data the document states of it. */
export interface ProducedPart {
  readonly part: Response.PartView<{}>;
  readonly extra: Extra.ExtraRecord<(typeof extrakit)["extra"], "response">;
}

/** The turn message a step states, and the extra data the document states of it. */
export interface StepPrompt {
  readonly prompt: Prompt.Prompt;
  readonly extra: Extra.ExtraRecord<(typeof extrakit)["extra"], "prompt">;
}

/**
 * The turn a step opens, as the one message the step states.
 *
 * A `system` step is text alone; every other step is the user's side of the conversation.
 */
export const stepPrompt = (
  step: StepObject,
  cwd: string | undefined,
): Effect.Effect<StepPrompt, PlatformError.PlatformError, Services> =>
  Effect.gen(function* () {
    if (step.source === "system") {
      return {
        prompt: Prompt.fromMessages([
          Prompt.makeMessage("system", { content: contentText(step.message) }),
        ]),
        extra: {},
      };
    }

    const pieces = yield* readPieces(step.message, cwd);

    const content: Array<Prompt.UserMessagePart> =
      pieces.length === 0
        ? [Prompt.makePart("text", { text: "" })]
        : pieces.map((piece) =>
            piece.kind === "text"
              ? Prompt.makePart("text", { text: piece.text })
              : Prompt.makePart("file", { mediaType: piece.mediaType, data: piece.data }),
          );

    return {
      prompt: Prompt.fromMessages([Prompt.makeMessage("user", { content })]),
      extra: mediaExtraRecord(pieces),
    };
  });

/** The id a result that answers no call is produced under. */
const unansweredResultId = (step: StepObject, at: number): string => `${step.step_id}-${at + 1}`;

/**
 * The results a step was answered with, as tool results and the files they hold.
 *
 * A result that names no call answers the first unanswered call of its step. A result
 * that states neither content nor a call is not produced, so what a producer wrote of it
 * is not carried either.
 */
export const stepResults = (
  step: StepObject,
  cwd: string | undefined,
): Effect.Effect<ReadonlyArray<ProducedPart>, PlatformError.PlatformError, Services> =>
  Effect.gen(function* () {
    const calls = step.tool_calls ?? [];
    const answered = new Set<string>();
    const parts: ProducedPart[] = [];

    for (const [at, result] of (step.observation?.results ?? []).entries()) {
      const stated = result.source_call_id ?? undefined;

      const call =
        stated === undefined
          ? calls.find((call) => !answered.has(call.tool_call_id))
          : calls.find((call) => call.tool_call_id === stated);

      if (call !== undefined) answered.add(call.tool_call_id);

      const statedContent = result.content;
      const pieces = statedContent === undefined ? [] : yield* readPieces(statedContent, cwd);
      const text = statedContent === undefined ? "" : contentText(statedContent);
      const files = pieces.filter((piece) => piece.kind === "file");

      if (call === undefined && text === "" && files.length === 0) continue;

      parts.push({
        part: Response.anyToolResultPart({
          id: call?.tool_call_id ?? unansweredResultId(step, at),
          name: call?.function_name ?? "",
          isFailure: false,
          result: text,
          encodedResult: text,
          providerExecuted: false,
          preliminary: false,
        }),
        extra: {
          [resultExtra.tag]: ResultFields.make({
            version: ResultFields.fields.version.literal,
            source_call_id: stated,
            extra: result.extra,
          }),
        },
      });

      for (const file of files) {
        parts.push({
          part: Response.makePart("file", { mediaType: file.mediaType, data: file.data }),
          extra: mediaExtraRecord([file]),
        });
      }
    }

    return parts;
  });

/**
 * The parts a model returned for one step, in the order it returned them.
 *
 * A step of another source returns nothing.
 */
export const stepResponses = (
  step: StepObject,
  cwd: string | undefined,
): Effect.Effect<ReadonlyArray<ProducedPart>, PlatformError.PlatformError, Services> =>
  Effect.gen(function* () {
    if (step.source !== "agent") return [];

    const parts: ProducedPart[] = [];

    const reasoning = step.reasoning_content ?? "";

    if (reasoning !== "") {
      parts.push({ part: Response.makePart("reasoning", { text: reasoning }), extra: {} });
    }

    for (const piece of yield* readPieces(step.message, cwd)) {
      if (piece.kind === "text") {
        if (piece.text !== "") {
          parts.push({ part: Response.makePart("text", { text: piece.text }), extra: {} });
        }

        continue;
      }

      parts.push({
        part: Response.makePart("file", { mediaType: piece.mediaType, data: piece.data }),
        extra: mediaExtraRecord([piece]),
      });
    }

    for (const call of step.tool_calls ?? []) {
      parts.push({
        part: Response.anyToolCallPart({
          id: call.tool_call_id,
          name: call.function_name,
          params: call.arguments,
          providerExecuted: false,
        }),
        extra:
          call.extra === undefined
            ? {}
            : {
                [callExtra.tag]: CallFields.make({
                  version: CallFields.fields.version.literal,
                  extra: call.extra,
                }),
              },
      });
    }

    for (const result of yield* stepResults(step, cwd)) parts.push(result);

    return parts;
  });
