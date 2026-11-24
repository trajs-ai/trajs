/**
 * Trajectory parts, their builders, and the schemas that read them back.
 *
 * Each schema reads one part kind of a trajectory with the kits of a config.
 * {@link parts} builds those parts with the kits of one config.
 *
 * @stability stable
 */

import { DateTime, Effect, Schema } from "effect";

import * as Event from "#/Event.ts";
import * as EventKit from "#/EventKit.ts";
import * as Extra from "#/Extra.ts";
import * as ExtraKit from "#/ExtraKit.ts";
import { TimestampString, Uuid } from "#/internal/schema.ts";
import * as Metric from "#/Metric.ts";
import * as MetricKit from "#/MetricKit.ts";
import * as Prompt from "#/Prompt.ts";
import * as Response from "#/Response.ts";
import * as Toolkit from "#/Toolkit.ts";
import type * as TrajectoryConfig from "#/TrajectoryConfig.ts";

const extraField = <K extends ExtraKit.Any, P extends Extra.Part>(extrakit: K, part: P) =>
  Extra.ExtraRecord(extrakit, part).pipe(Schema.withDecodingDefault(Effect.succeed({})));

/**
 * Schema for a prompt part of `extrakit`.
 *
 * **When to use**
 *
 * Use when a stored prompt must be decoded with the extras of one kit.
 *
 * **Details**
 *
 * `messages` holds the content of a {@link Prompt.Prompt}.
 * `extra` decodes as `{}` when the payload omits it.
 * `uuid` is a uuid v7. Construction fills one when the caller omits it.
 * A missing `sessionId` means {@link mainSessionId}.
 * `timestamp` is the moment the part was produced.
 * A missing `startTimestamp` leaves that moment alone.
 *
 * **Gotchas**
 *
 * `timestamp` stays absent when omitted.
 * {@link ResponsePart} requires it.
 *
 * @see {@link parts} for building a prompt part from a {@link Prompt.Prompt}.
 * @see {@link TrajectoryConfig.PromptPartOf} for the prompt part of a config.
 * @stability stable
 * @category schemas
 */
export const PromptPart = <K extends ExtraKit.Any>(extrakit: K) =>
  Schema.TaggedStruct("Prompt", {
    sessionId: Schema.optional(Schema.String),
    uuid: Uuid,
    timestamp: Schema.optional(TimestampString),
    startTimestamp: Schema.optional(TimestampString),
    messages: Schema.Array(Prompt.Message),
    extra: extraField(extrakit, "prompt"),
  });

/**
 * A prompt part decoded with `extrakit`.
 *
 * @see {@link PromptPart} for the schema.
 * @stability stable
 * @category models
 */
export type PromptPart<K extends ExtraKit.Any> = Schema.Schema.Type<
  ReturnType<typeof PromptPart<K>>
>;

/**
 * The wire form of a {@link PromptPart}.
 *
 * **Details**
 *
 * The alias is not generic.
 * Each extra value stays unknown under {@link ExtraKit.Any}.
 *
 * @stability stable
 * @category encoding
 */
export type PromptPartEncoded = Schema.Codec.Encoded<ReturnType<typeof PromptPart<ExtraKit.Any>>>;

/**
 * The id of the main session, `"main"`.
 *
 * **Details**
 *
 * A part with no `sessionId` belongs to the main session.
 * Stating this id means the same session.
 * The main session needs no declaration of its own.
 *
 * @see {@link SessionPart} for the `main` and `sub` declarations.
 * @stability stable
 * @category constants
 */
export const mainSessionId = "main";

const MainSession = Schema.TaggedStruct("main", { id: Schema.Literal(mainSessionId) });

/**
 * The declaration of the main session.
 *
 * **Details**
 *
 * `id` is {@link mainSessionId}, and it has no `fork`.
 *
 * @see {@link subSession} for the declaration of a session forked from another.
 * @stability stable
 * @category constants
 */
export const mainSession = MainSession.make({ id: mainSessionId });

const SubSession = Schema.TaggedStruct("sub", { id: Schema.String, fork: Uuid });

/**
 * Creates the declaration of a session forked from an earlier part.
 *
 * **Details**
 *
 * `id` names the new session, and `fork` is the uuid of the part it branches
 * from.
 *
 * @see {@link mainSession} for the declaration every trajectory already has.
 * @see {@link parts} for building the whole session part.
 * @stability stable
 * @category constructors
 */
export const subSession = (id: string, { fork }: { fork: string }) => SubSession.make({ id, fork });

/**
 * Schema for a session declaration of `extrakit`.
 *
 * **When to use**
 *
 * Use when a stored session declaration must be decoded with the extras of one kit.
 *
 * **Details**
 *
 * `type` is `main` or `sub`.
 * `main` carries {@link mainSessionId}.
 * `sub` carries its own `id` and a `fork` uuid.
 * `extra` decodes as `{}` when the payload omits it.
 * `uuid` is a uuid v7. Construction fills one when the caller omits it.
 *
 * **Gotchas**
 *
 * A session declaration has no `timestamp` and no `sessionId`.
 *
 * @see {@link parts} for `mainSession` and `subSession`.
 * @see {@link TrajectoryConfig.SessionPartOf} for the session part of a config.
 * @stability stable
 * @category schemas
 */
export const SessionPart = <K extends ExtraKit.Any>(extrakit: K) =>
  Schema.TaggedStruct("Session", {
    type: Schema.Union([MainSession, SubSession]),
    uuid: Uuid,
    extra: extraField(extrakit, "session"),
  });

/**
 * A session declaration decoded with `extrakit`.
 *
 * @see {@link SessionPart} for the schema.
 * @stability stable
 * @category models
 */
export type SessionPart<K extends ExtraKit.Any> = Schema.Schema.Type<
  ReturnType<typeof SessionPart<K>>
>;

/**
 * The wire form of a {@link SessionPart}.
 *
 * **Details**
 *
 * The alias is not generic.
 * Each extra value stays unknown under {@link ExtraKit.Any}.
 *
 * @stability stable
 * @category encoding
 */
export type SessionPartEncoded = Schema.Codec.Encoded<ReturnType<typeof SessionPart<ExtraKit.Any>>>;

/**
 * Schema for a response part of `toolkit` and `extrakit`.
 *
 * **When to use**
 *
 * Use when a response part must be read with the tools and extras of one config.
 *
 * **Details**
 *
 * `response` is one finished response part, a {@link Response.Part}.
 * The schema also accepts parts built for tools beyond `toolkit`.
 * `extra` decodes as `{}` when the payload omits it.
 * `timestamp` is required. Construction uses the current time when the caller omits it.
 * `uuid` is a uuid v7. Construction fills one when the caller omits it.
 * A missing `sessionId` means {@link mainSessionId}.
 * A missing `startTimestamp` leaves the moment of `timestamp` alone.
 *
 * **Gotchas**
 *
 * A streamed answer is many parts while it is written.
 * A trajectory holds the part the answer ended in, not those increments.
 *
 * @see {@link parts} for building a response part.
 * @see {@link TrajectoryConfig.ResponsePartOf} for the response part of a config.
 * @stability stable
 * @category schemas
 */
export const ResponsePart = <Toolkit extends Toolkit.Any, Extras extends ExtraKit.Any>({
  toolkit,
  extrakit,
}: {
  toolkit: Toolkit;
  extrakit: Extras;
}) =>
  Schema.TaggedStruct("Response", {
    timestamp: TimestampString,
    startTimestamp: Schema.optional(TimestampString),
    sessionId: Schema.optional(Schema.String),
    uuid: Uuid,
    response: Schema.Union([Response.Part(toolkit), Response.Part()]),
    extra: extraField(extrakit, "response"),
  });

/**
 * A response part decoded for `Toolkit` and `Extras`.
 *
 * @see {@link ResponsePart} for the schema.
 * @stability stable
 * @category models
 */
export type ResponsePart<
  Toolkit extends Toolkit.Any,
  Extras extends ExtraKit.Any,
> = Schema.Schema.Type<ReturnType<typeof ResponsePart<Toolkit, Extras>>>;

/**
 * The wire form of a {@link ResponsePart}.
 *
 * **Details**
 *
 * The alias is not generic.
 * Each response payload stays unknown under {@link Toolkit.Any}.
 *
 * @stability stable
 * @category encoding
 */
export type ResponsePartEncoded = Schema.Codec.Encoded<
  ReturnType<typeof ResponsePart<Toolkit.Any, ExtraKit.Any>>
>;

/**
 * Schema for an event part of `eventkit`.
 *
 * **When to use**
 *
 * Use when a stored event must be decoded with the events of one kit.
 *
 * **Details**
 *
 * `event` is one event the kit declares.
 * `timestamp` is required. Construction uses the current time when the caller omits it.
 * A missing `startTimestamp` leaves that moment alone.
 * A missing `sessionId` means {@link mainSessionId}.
 * `uuid` is a uuid v7. Construction fills one when the caller omits it.
 *
 * **Gotchas**
 *
 * An event part carries no extras.
 *
 * @see {@link parts} for building an event part.
 * @see {@link TrajectoryConfig.EventPartOf} for the event part of a config.
 * @stability stable
 * @category schemas
 */
export const EventPart = <K extends EventKit.Any>(eventkit: K) =>
  Schema.TaggedStruct("Event", {
    timestamp: TimestampString,
    startTimestamp: Schema.optional(TimestampString),
    sessionId: Schema.optional(Schema.String),
    uuid: Uuid,
    event: Event.EventParts(eventkit),
  });

/**
 * An event part decoded with `eventkit`.
 *
 * @see {@link EventPart} for the schema.
 * @stability stable
 * @category models
 */
export type EventPart<K extends EventKit.Any> = Schema.Schema.Type<ReturnType<typeof EventPart<K>>>;

/**
 * The wire form of an {@link EventPart}.
 *
 * **Details**
 *
 * The alias is not generic.
 * The event payload stays unknown under {@link EventKit.Any}.
 *
 * @stability stable
 * @category encoding
 */
export type EventPartEncoded = Schema.Codec.Encoded<ReturnType<typeof EventPart<EventKit.Any>>>;

/**
 * Schema for a metric part of `metrickit`.
 *
 * **When to use**
 *
 * Use when a stored metric must be decoded with the metrics of one kit.
 *
 * **Details**
 *
 * `metric` is one metric the kit declares, with its tag and its attachments.
 * `timestamp` and `startTimestamp` stay absent when omitted.
 *
 * **Gotchas**
 *
 * A metric part has no `uuid` and no `sessionId`.
 *
 * @see {@link parts} for building a metric part.
 * @see {@link TrajectoryConfig.MetricPartOf} for the metric part of a config.
 * @stability stable
 * @category schemas
 */
export const MetricPart = <K extends MetricKit.Any>(metrickit: K) =>
  Schema.TaggedStruct("Metric", {
    timestamp: Schema.optional(TimestampString),
    startTimestamp: Schema.optional(TimestampString),
    metric: Metric.MetricParts(metrickit),
  });

/**
 * A metric part decoded with `metrickit`.
 *
 * @see {@link MetricPart} for the schema.
 * @stability stable
 * @category models
 */
export type MetricPart<K extends MetricKit.Any> = Schema.Schema.Type<
  ReturnType<typeof MetricPart<K>>
>;

/**
 * The wire form of a {@link MetricPart}.
 *
 * **Details**
 *
 * The alias is not generic.
 * The metric payload stays unknown under {@link MetricKit.Any}.
 *
 * @stability stable
 * @category encoding
 */
export type MetricPartEncoded = Schema.Codec.Encoded<ReturnType<typeof MetricPart<MetricKit.Any>>>;

/**
 * Builders for every part kind of one config.
 *
 * **When to use**
 *
 * Use when each part should match the kits and the variant of that config.
 *
 * **Details**
 *
 * A builder takes the part body, then options.
 * State a known `uuid`, `timestamp`, `startTimestamp`, or `sessionId` there.
 * Pass extra fields beside those options, not under an `extra` key.
 * `subSession` requires `fork`, the uuid of an earlier part.
 *
 * **Gotchas**
 *
 * An omitted `uuid` becomes a new uuid v7.
 * An omitted required `timestamp` becomes the current time.
 * Pass a known `uuid` when a later session must fork from that part.
 *
 * @see {@link parts} for the builders of one config.
 * @stability stable
 * @category models
 */
export interface Parts<Config extends TrajectoryConfig.AnyConfig> {
  readonly prompt: (
    prompt: Prompt.Prompt,
    options?: {
      readonly sessionId?: string;
      readonly timestamp?: DateTime.Utc;
      readonly startTimestamp?: DateTime.Utc;
      readonly uuid?: string;
    } & Extra.ExtraRecord<TrajectoryConfig.ExtrasOf<Config>, "prompt">,
  ) => PromptPart<Config["extrakit"]>;

  readonly mainSession: (
    options?: {
      readonly uuid?: string;
    } & Extra.ExtraRecord<TrajectoryConfig.ExtrasOf<Config>, "session">,
  ) => SessionPart<Config["extrakit"]>;

  readonly subSession: (
    id: string,
    options: {
      readonly fork: string;
      readonly uuid?: string;
    } & Extra.ExtraRecord<TrajectoryConfig.ExtrasOf<Config>, "session">,
  ) => SessionPart<Config["extrakit"]>;

  readonly response: (
    response: ResponsePart<Config["toolkit"], Config["extrakit"]>["response"],
    options?: {
      readonly sessionId?: string;
      readonly timestamp?: DateTime.Utc;
      readonly startTimestamp?: DateTime.Utc;
      readonly uuid?: string;
    } & Extra.ExtraRecord<TrajectoryConfig.ExtrasOf<Config>, "response">,
  ) => ResponsePart<Config["toolkit"], Config["extrakit"]>;

  readonly event: (
    event: Event.EventParts<TrajectoryConfig.EventsOf<Config>>,
    options?: {
      readonly sessionId?: string;
      readonly timestamp?: DateTime.Utc;
      readonly startTimestamp?: DateTime.Utc;
      readonly uuid?: string;
    },
  ) => EventPart<Config["eventkit"]>;

  readonly metric: (
    metric: Metric.MetricParts<TrajectoryConfig.MetricsOf<Config>>,
    options?: { readonly timestamp?: DateTime.Utc; readonly startTimestamp?: DateTime.Utc },
  ) => MetricPart<Config["metrickit"]>;
}

/**
 * Returns the {@link Parts} builders of `config`.
 *
 * **When to use**
 *
 * Use when parts should take their kits from one config.
 *
 * @see `Trajectory.make` for a trajectory of those parts.
 * @stability stable
 * @category constructors
 */
export const parts = <Config extends TrajectoryConfig.AnyConfig>(config: Config): Parts<Config> => {
  const Prompt = PromptPart(config.extrakit);
  const Session = SessionPart(config.extrakit);

  const Response = ResponsePart({
    toolkit: config.toolkit,
    extrakit: config.extrakit,
  });

  const Event = EventPart(config.eventkit);
  const Metric = MetricPart(config.metrickit);

  return {
    prompt: (prompt, options = {}) => {
      const { sessionId, timestamp, startTimestamp, uuid, ...extra } = options;

      return Prompt.make({
        messages: prompt.content,
        sessionId,
        extra,
        timestamp,
        startTimestamp,
        uuid,
      });
    },
    mainSession: (options = {}) => {
      const { uuid, ...extra } = options;

      return Session.make({ type: MainSession.make({ id: mainSessionId }), extra, uuid });
    },
    subSession: (id, { fork, uuid, ...extra }) =>
      Session.make({ type: SubSession.make({ id, fork }), extra, uuid }),
    response: (response, options = {}) => {
      const { sessionId, timestamp, startTimestamp, uuid, ...extra } = options;

      // SAFETY: the schema uses the same configuration as the return type.
      return Response.make({
        response,
        sessionId,
        extra,
        timestamp,
        startTimestamp,
        uuid,
      }) as ResponsePart<Config["toolkit"], Config["extrakit"]>;
    },
    event: (event, options = {}) => {
      const { sessionId, timestamp, startTimestamp, uuid } = options;

      return Event.make({ event, sessionId, timestamp, startTimestamp, uuid });
    },
    metric: (metric, options = {}) => {
      const { timestamp, startTimestamp } = options;

      return Metric.make({ metric, timestamp, startTimestamp });
    },
  };
};

/**
 * One part of a trajectory read with `Config`.
 *
 * @see {@link TrajectoryConfig.PromptPartOf} for a prompt.
 * @see {@link TrajectoryConfig.SessionPartOf} for a session declaration.
 * @see {@link TrajectoryConfig.ResponsePartOf} for a response.
 * @see {@link TrajectoryConfig.EventPartOf} for an event.
 * @see {@link TrajectoryConfig.MetricPartOf} for a metric.
 * @stability stable
 * @category models
 */
export type Part<Config extends TrajectoryConfig.AnyConfig> =
  | PromptPart<Config["extrakit"]>
  | SessionPart<Config["extrakit"]>
  | ResponsePart<Config["toolkit"], Config["extrakit"]>
  | EventPart<Config["eventkit"]>
  | MetricPart<Config["metrickit"]>;
