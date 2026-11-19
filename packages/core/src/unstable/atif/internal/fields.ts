/**
 * The extra data a document states of a run, a step and the media of a part.
 *
 * Each value is what one extra of `Extra.ts` holds on the part of the session, step or
 * media it belongs to.
 */

import { DateTime, Option, Schema } from "effect";

import type * as Extra from "#/Extra.ts";
import type { Document, StepObject } from "#/unstable/atif/Document.ts";
import {
  DocumentFields,
  extrakit,
  mediaExtra,
  MediaFields,
  StepFields,
  stepExtra,
} from "#/unstable/atif/Extra.ts";
import type { Piece } from "#/unstable/atif/internal/content.ts";

/** What a document states of one tool definition beside the tool it names. */
type ToolFields = NonNullable<DocumentFields["agent"]["tool_definitions"]>[string];

/** What a document states of each tool definition beside the tool it names, by that name. */
const toolFields = (agent: Document["agent"]): DocumentFields["agent"]["tool_definitions"] => {
  const definitions = agent.tool_definitions ?? [];

  if (definitions.length === 0) return undefined;

  const stated: Record<string, ToolFields> = {};

  for (const definition of definitions) {
    stated[definition.function.name] = {
      type: definition.type,
      strict: definition.function.strict,
      extra: definition.extra,
    };
  }

  return stated;
};

/** What a document states of the run itself, held by the session part. */
export const documentFields = (document: Document): DocumentFields =>
  DocumentFields.make({
    version: DocumentFields.fields.version.literal,
    schema_version: document.schema_version,
    agent: {
      name: document.agent.name,
      version: document.agent.version,
      model_name: document.agent.model_name,
      tool_definitions: toolFields(document.agent),
      extra: document.agent.extra,
    },
    trajectory_id: document.trajectory_id,
    notes: document.notes,
    final_metrics: document.final_metrics,
    extra: document.extra,
  });

/** What a document states of one step beyond what it says, held by the part of that step. */
export const stepFields = (step: StepObject): StepFields =>
  StepFields.make({
    version: StepFields.fields.version.literal,
    step_id: step.step_id,
    model_name: step.model_name,
    reasoning_effort: step.reasoning_effort,
    llm_call_count: step.llm_call_count,
    metrics: step.metrics,
    extra: step.extra,
  });

/** The moment a document times a step at, where it states one that reads. */
const momentOf = (step: StepObject): DateTime.Utc | undefined =>
  Option.getOrUndefined(
    Schema.decodeUnknownOption(Schema.DateTimeUtcFromString)(step.timestamp ?? undefined),
  );

/** What a document states of one step. */
export interface StepStates {
  readonly fields: StepFields;
  readonly moment: DateTime.Utc | undefined;
}

/** What a document states of a step, read from the step. */
export const stepStates = (step: StepObject): StepStates => ({
  fields: stepFields(step),
  moment: momentOf(step),
});

/** The extra data the part of a step holds. */
export const stepExtraRecord = (
  states: StepStates | undefined,
): Extra.ExtraRecord<(typeof extrakit)["extra"], "prompt"> =>
  states === undefined ? {} : { [stepExtra.tag]: states.fields };

/**
 * What a part holds of the media it states, which the bytes of a recording do not say.
 *
 * The seconds each recording lasts, by the ordinal of the media among the ones the part
 * states.
 */
export const mediaExtraRecord = (
  pieces: ReadonlyArray<Piece>,
): Partial<Record<typeof mediaExtra.tag, MediaFields>> => {
  const duration: Record<string, number> = {};
  let ordinal = 0;

  for (const piece of pieces) {
    if (piece.kind === "text") continue;

    if (piece.duration !== undefined) duration[String(ordinal)] = piece.duration;

    ordinal += 1;
  }

  return Object.keys(duration).length === 0
    ? {}
    : {
        [mediaExtra.tag]: MediaFields.make({
          version: MediaFields.fields.version.literal,
          duration,
        }),
      };
};
