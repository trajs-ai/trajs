import { Effect, Match, Option, Predicate, Stream } from "effect";

import type * as Session from "#/Session.ts";
import * as Trajectory from "#/Trajectory.ts";
import type * as TrajectoryConfig from "#/TrajectoryConfig.ts";
import { TrajectoryError } from "#/TrajectoryError.ts";
import * as TrajectoryPart from "#/TrajectoryPart.ts";

/** A part a session stream holds: every part but a session declaration. */
type Part<Config extends TrajectoryConfig.AnyConfig> = Exclude<
  TrajectoryPart.Part<Config>,
  TrajectoryPart.SessionPart<Config["extrakit"]>
>;

/** A part that names a session: every part but a metric, which names its targets. */
type Naming<Config extends TrajectoryConfig.AnyConfig> = Exclude<
  TrajectoryPart.Part<Config>,
  TrajectoryConfig.MetricPartOf<Config>
>;

/** A session declaration, as one reading of a trajectory records it. */
interface Declared {
  /** The uuid of the part the session continues from. */
  readonly fork: string;
  /** Where the declaration is in the trajectory, counting from zero. */
  readonly index: number;
}

/**
 * What one reading of a trajectory states of its sessions.
 *
 * A part names a session before that session is declared, so the names read are
 * checked against the declarations once the whole trajectory is read.
 */
interface Recorded {
  /** Every session declared, by the id it declares. */
  readonly declared: Map<string, Declared>;
  /** Every session a part named before it was declared. */
  readonly named: Set<string>;
  /** Every part uuid a metric result attaches to. */
  readonly attached: Set<string>;
}

/** The session a part states, or the main session where it states none. */
const statedSession = (part: { readonly sessionId?: string }): string =>
  part.sessionId ?? TrajectoryPart.mainSessionId;

/** Whether a part names a session: a metric names the parts it attaches to instead. */
const namesSession = <Config extends TrajectoryConfig.AnyConfig>(
  part: TrajectoryPart.Part<Config>,
): part is Naming<Config> => !Predicate.isTagged("Metric")(part);

/** The session a part names: the one it states, or the one it declares. */
const sessionOf = <Config extends TrajectoryConfig.AnyConfig>(part: Naming<Config>): string =>
  Match.valueTags(part, {
    Prompt: statedSession,
    Response: statedSession,
    Event: statedSession,
    Session: (declared) => declared.type.id,
  });

/**
 * The part each declared session continues from: the uuid of the part, and the
 * session that holds it.
 */
interface ForkFrom {
  readonly session: string;
  readonly uuid: string;
}

/**
 * Records the declaration of `session`, failing where the session it declares
 * was named before it was declared.
 */
const declare = <Config extends TrajectoryConfig.AnyConfig>(
  recorded: Recorded,
  session: TrajectoryPart.SessionPart<Config["extrakit"]>,
  index: number,
): Effect.Effect<void, TrajectoryError> => {
  const type = session.type;
  const id = type.id;

  if (id === TrajectoryPart.mainSessionId || recorded.declared.has(id)) {
    return Effect.void;
  }

  // A session is declared before the parts it produced.
  if (recorded.named.has(id)) {
    return Effect.fail(TrajectoryError.session(id, "late-declaration"));
  }

  if (Predicate.isTagged("main")(type)) {
    return Effect.void;
  }

  recorded.declared.set(id, { fork: type.fork, index });

  return Effect.void;
};

/** Records what one part states of the sessions: a name, a declaration, or attachments. */
const recordPart = <Config extends TrajectoryConfig.AnyConfig>(
  recorded: Recorded,
  part: TrajectoryPart.Part<Config>,
  index: number,
): Effect.Effect<void, TrajectoryError> => {
  if (!namesSession(part)) {
    for (const target of part.metric.data.attach ?? []) {
      recorded.attached.add(target);
    }

    return Effect.void;
  }

  if (Predicate.isTagged("Session")(part)) {
    return declare(recorded, part, index);
  }

  recorded.named.add(sessionOf(part));

  return Effect.void;
};

/** The first session a part names that no declaration states, if any. */
const firstUndeclared = (recorded: Recorded): string | undefined =>
  [...recorded.named].find(
    (id) => id !== TrajectoryPart.mainSessionId && !recorded.declared.has(id),
  );

/** What a first read of `trajectory` states of its sessions, in the order it states them. */
const recordTrajectory = <Config extends TrajectoryConfig.AnyConfig, E, R>(
  trajectory: Stream.Stream<TrajectoryPart.Part<Config>, E, R>,
): Effect.Effect<Recorded, E | TrajectoryError, R> =>
  Effect.gen(function* () {
    const recorded: Recorded = {
      declared: new Map(),
      named: new Set(),
      attached: new Set(),
    };

    yield* trajectory.pipe(
      Stream.zipWithIndex,
      Stream.runForEach(([part, index]) => recordPart(recorded, part, index)),
    );

    const missing = firstUndeclared(recorded);

    if (missing !== undefined) {
      return yield* Effect.fail(TrajectoryError.session(missing, "undeclared-session"));
    }

    return recorded;
  });

/**
 * The session each declared session continues from, by the id of the session it
 * declares, in declaration order.
 */
const resolveForks = <Config extends TrajectoryConfig.AnyConfig, E, R>(
  trajectory: Stream.Stream<TrajectoryPart.Part<Config>, E, R>,
  recorded: Recorded,
): Effect.Effect<Map<string, ForkFrom>, E | TrajectoryError, R> =>
  Effect.gen(function* () {
    const wanted = new Set<string>();
    let last = 0;

    for (const declared of recorded.declared.values()) {
      wanted.add(declared.fork);
      last = Math.max(last, declared.index);
    }

    const found = new Map<string, { readonly index: number; readonly session: string }>();

    // No part comes before a declaration at the start of the trajectory.
    if (last > 0) {
      yield* trajectory.pipe(
        Stream.zipWithIndex,
        Stream.take(last),
        Stream.takeWhile(() => found.size < wanted.size),
        Stream.runForEach(([part, index]) =>
          Effect.sync(() => {
            // An event and a metric part cannot be a fork target.
            if (
              !namesSession(part) ||
              Predicate.isTagged("Event")(part) ||
              !wanted.has(part.uuid)
            ) {
              return;
            }

            found.set(part.uuid, { index, session: sessionOf(part) });
          }),
        ),
      );
    }

    const forkedFrom = new Map<string, ForkFrom>();

    for (const [id, declared] of recorded.declared) {
      const target = found.get(declared.fork);

      // A fork names a part from before its declaration.
      if (target === undefined || target.index >= declared.index) {
        return yield* Effect.fail(TrajectoryError.session(id, "unproduced-fork"));
      }

      forkedFrom.set(id, { session: target.session, uuid: declared.fork });
    }

    return forkedFrom;
  });

/**
 * Whether `part` is read in the session `id` names.
 *
 * The uuids of the parts read so far decide the sessions a metric is read in:
 * a metric states no session, and belongs to every part it attaches to.
 */
const belongsTo = <Config extends TrajectoryConfig.AnyConfig>(
  part: TrajectoryPart.Part<Config>,
  id: string,
  attached: ReadonlySet<string>,
  seen: Set<string>,
): part is Part<Config> => {
  if (!namesSession(part)) {
    return (part.metric.data.attach ?? []).some((target) => seen.has(target));
  }

  if (sessionOf(part) !== id) {
    return false;
  }

  // A declaration is not a part of the session it declares, but a metric
  // naming it is read in that session.
  if (attached.has(part.uuid)) {
    seen.add(part.uuid);
  }

  return !Predicate.isTagged("Session")(part);
};

/** The parts of `trajectory` read in the session `id` names, one pull at a time. */
const sessionStream = <Config extends TrajectoryConfig.AnyConfig, E, R>(
  trajectory: Stream.Stream<TrajectoryPart.Part<Config>, E, R>,
  id: string,
  attached: ReadonlySet<string>,
): Session.SessionStream<Config, E, R> =>
  // Each pull tracks its own part uuids, so one pull does not see another.
  Stream.suspend(() => {
    const seen = new Set<string>();

    return trajectory.pipe(Stream.filter((part) => belongsTo(part, id, attached, seen)));
  });

/** The session tree `trajectory` states, each session stream reading it again. */
const sessionTree = <Config extends TrajectoryConfig.AnyConfig, E, R>(
  trajectory: Stream.Stream<TrajectoryPart.Part<Config>, E, R>,
  recorded: Recorded,
  forkedFrom: ReadonlyMap<string, ForkFrom>,
): Effect.Effect<Session.MainSession<Config, E | TrajectoryError, R>, TrajectoryError> =>
  Effect.gen(function* () {
    const root: Session.MainSession<Config, E | TrajectoryError, R> = {
      id: TrajectoryPart.mainSessionId,
      forkBy: {},
      stream: sessionStream(trajectory, TrajectoryPart.mainSessionId, recorded.attached),
    };

    const sessions = new Map<string, Session.Session<Config, E | TrajectoryError, R>>();

    for (const [id, forkFrom] of forkedFrom) {
      const parent =
        forkFrom.session === TrajectoryPart.mainSessionId ? root : sessions.get(forkFrom.session);

      // A fork may name a part of a session that is declared later, which is
      // not built yet.
      if (parent === undefined) {
        return yield* Effect.fail(TrajectoryError.session(id, "unproduced-fork"));
      }

      const forked: Session.Session<Config, E | TrajectoryError, R> = {
        id,
        forkFrom: { session: parent, uuid: forkFrom.uuid },
        forkBy: {},
        stream: sessionStream(trajectory, id, recorded.attached),
      };

      parent.forkBy[id] = forked;
      sessions.set(id, forked);
    }

    return root;
  });

/** Reads `trajectory` into the tree of the sessions its parts state. */
export const read = <Config extends TrajectoryConfig.AnyConfig, E, R>(
  trajectory: Trajectory.TrajectoryStream<Config, E, R>,
): Effect.Effect<Session.MainSession<Config, E | TrajectoryError, R>, E | TrajectoryError, R> =>
  Effect.gen(function* () {
    const recorded = yield* recordTrajectory(trajectory);
    const forkedFrom = yield* resolveForks(trajectory, recorded);

    return yield* sessionTree(trajectory, recorded, forkedFrom);
  });

/** Whether `part` is the part `uuid` names. A metric carries no uuid, so it never ends one. */
const endsAt =
  <Config extends TrajectoryConfig.AnyConfig>(uuid: string) =>
  (part: TrajectoryPart.Part<Config>): boolean =>
    !Predicate.isTagged("Metric")(part) && part.uuid === uuid;

/** Whether `stream` holds the part `uuid` names. */
const holds = <Config extends TrajectoryConfig.AnyConfig, E, R>(
  stream: Session.SessionStream<Config, E, R>,
  uuid: string,
): Effect.Effect<boolean, E, R> => {
  const ends = endsAt<Config>(uuid);

  return stream.pipe(
    Stream.takeUntil(ends),
    Stream.runFold(
      () => false,
      (_, part) => ends(part),
    ),
  );
};

/** The parts `stream` read up to the fork part `fork`, and none where it does not hold it. */
const inherited = <Config extends TrajectoryConfig.AnyConfig, E, R>(
  stream: Session.SessionStream<Config, E, R>,
  fork: string,
): Session.SessionStream<Config, E, R> =>
  holds(stream, fork).pipe(
    Effect.map((produces) =>
      produces ? stream.pipe(Stream.takeUntil(endsAt<Config>(fork))) : Stream.empty,
    ),
    Stream.unwrap,
  );

/** The parts `session` holds after the prefixes it inherits from its ancestors, root first. */
export const sessionParts = <Config extends TrajectoryConfig.AnyConfig, E, R>(
  session: Session.AnySession<Config, E, R>,
): Session.SessionStream<Config, E, R> => {
  const streams: Array<Session.SessionStream<Config, E, R>> = [];

  let current: Session.AnySession<Config, E, R> = session;

  while ("forkFrom" in current) {
    streams.push(inherited(current.forkFrom.session.stream, current.forkFrom.uuid));

    current = current.forkFrom.session;
  }

  return streams.reduce((produced, stream) => Stream.concat(stream, produced), session.stream);
};

/** Every session of the tree, depth first from `main`. */
export const allSessions = <Config extends TrajectoryConfig.AnyConfig, E, R>(
  main: Session.MainSession<Config, E, R>,
): ReadonlyArray<Session.AnySession<Config, E, R>> => {
  const sessions: Array<Session.AnySession<Config, E, R>> = [];

  const visit = (session: Session.AnySession<Config, E, R>): void => {
    sessions.push(session);

    for (const forked of Object.values(session.forkBy)) {
      visit(forked);
    }
  };

  visit(main);

  return sessions;
};

/** The session `id` names, searched from `session` down the tree. */
export const findSession = <Config extends TrajectoryConfig.AnyConfig, E, R>(
  session: Session.AnySession<Config, E, R>,
  id: string,
): Option.Option<Session.AnySession<Config, E, R>> => {
  if (session.id === id) {
    return Option.some(session);
  }

  for (const forked of Object.values(session.forkBy)) {
    const found = findSession(forked, id);

    if (Option.isSome(found)) {
      return found;
    }
  }

  return Option.none();
};
