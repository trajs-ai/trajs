/**
 * A document produced into a trajectory: its session, and the turns of its steps.
 */

import { Effect } from "effect";
import type { PlatformError } from "effect";

import * as Produce from "#/Produce.ts";
import type { TrajectoryError } from "#/TrajectoryError.ts";
import type { Document } from "#/unstable/atif/Document.ts";
import * as AtifEvent from "#/unstable/atif/Event.ts";
import { documentExtra, extrakit } from "#/unstable/atif/Extra.ts";
import type { Services } from "#/unstable/atif/internal/content.ts";
import { documentFields, stepExtraRecord } from "#/unstable/atif/internal/fields.ts";
import type { Tools } from "#/unstable/atif/internal/toolkit.ts";
import { readTurns } from "#/unstable/atif/internal/turns.ts";

/** The session a document's steps are produced in, where the document names none. */
const unnamedSession = "atif";

/**
 * The id of the session a document's steps are produced in.
 *
 * `session_id` names the run. Every document of one run states the same value, so it
 * names no session.
 */
const sessionIdOf = (document: Document): string => document.trajectory_id ?? unnamedSession;

/**
 * Produces the turns of a document, in the order the document states them.
 *
 * The session is declared before the parts produced in it, and forked from the main
 * session. What the document states of the run is declared with it, and what it states
 * of a step with the part of that step.
 */
export const produceDocument = (
  main: Produce.ProduceSession<
    Tools,
    (typeof AtifEvent.eventkit)["events"],
    (typeof extrakit)["extra"]
  >,
  document: Document,
  cwd: string | undefined,
): Effect.Effect<void, TrajectoryError | PlatformError.PlatformError, Services> =>
  Effect.gen(function* () {
    const session = yield* main.forkSession({
      id: sessionIdOf(document),
      [documentExtra.tag]: documentFields(document),
    });

    for (const turn of yield* readTurns(document, cwd)) {
      yield* session.enqueuePrompt(turn.prompt, {
        ...turn.promptExtra,
        ...stepExtraRecord(turn.promptStates),
        timestamp: turn.promptStates?.moment,
      });

      for (const [at, produced] of turn.response.entries()) {
        const states = at === 0 ? turn.answerStates : undefined;

        yield* session.enqueueResponse(produced.part, {
          ...produced.extra,
          ...stepExtraRecord(states),
          timestamp: states?.moment,
        });
      }
    }
  });
