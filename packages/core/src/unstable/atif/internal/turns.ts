/**
 * The turns a document's steps are read as.
 *
 * A step that states a message opens a turn with it, an agent step is produced as the
 * parts of the response it answered with, and a step that follows an answered turn opens
 * one of its own with no message.
 */

import { Effect } from "effect";
import type { PlatformError } from "effect";

import type * as Extra from "#/Extra.ts";
import * as Prompt from "#/Prompt.ts";
import type { Document } from "#/unstable/atif/Document.ts";
import type { extrakit } from "#/unstable/atif/Extra.ts";
import type { Services } from "#/unstable/atif/internal/content.ts";
import { stepStates } from "#/unstable/atif/internal/fields.ts";
import type { StepStates } from "#/unstable/atif/internal/fields.ts";
import { stepPrompt, stepResponses } from "#/unstable/atif/internal/parts.ts";
import type { ProducedPart, StepPrompt } from "#/unstable/atif/internal/parts.ts";

/** A turn of a document's steps, before it is produced. */
export interface Turn {
  prompt: Prompt.Prompt;
  /** What the document states of the media the prompt holds. */
  promptExtra: Extra.ExtraRecord<(typeof extrakit)["extra"], "prompt">;
  /** What the document states of the step that stated the prompt. */
  promptStates: StepStates | undefined;
  response: Array<ProducedPart>;
  /** What the document states of the step that answered, held by the first response part. */
  answerStates: StepStates | undefined;
  answered: boolean;
}

/**
 * The turns of a document, read in the order it states its steps.
 *
 * ATIF states one step per inference, so a step that follows an answered turn opens one
 * of its own with no message. What the document states of a step hangs on the first part
 * the reading produces for it.
 */
export const readTurns = (
  document: Document,
  cwd: string | undefined,
): Effect.Effect<ReadonlyArray<Turn>, PlatformError.PlatformError, Services> =>
  Effect.gen(function* () {
    const turns: Turn[] = [];

    for (const step of document.steps) {
      const parts = yield* stepResponses(step, cwd);
      const states = stepStates(step);
      const open = step.source === "agent" ? turns.at(-1) : undefined;

      if (open !== undefined && !open.answered) {
        for (const part of parts) open.response.push(part);

        open.answered = true;

        if (parts.length > 0) open.answerStates = states;

        continue;
      }

      const answered = step.source === "agent";
      const onResponse = answered && parts.length > 0;

      const opened: StepPrompt = answered
        ? { prompt: Prompt.empty, extra: {} }
        : yield* stepPrompt(step, cwd);

      turns.push({
        prompt: opened.prompt,
        promptExtra: opened.extra,
        promptStates: onResponse ? undefined : states,
        response: [...parts],
        answerStates: onResponse ? states : undefined,
        answered,
      });
    }

    return turns;
  });
