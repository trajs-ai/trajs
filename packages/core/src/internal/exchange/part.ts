import { Effect, Match, Schema, SchemaGetter } from "effect";
import type { DateTime } from "effect";
import type { NonEmptyReadonlyArray } from "effect/Array";
import { SchemaBinary } from "effect/encoding";

import type * as Config from "#/Config.ts";
import * as Event from "#/Event.ts";
import * as EventKit from "#/EventKit.ts";
import * as Extra from "#/Extra.ts";
import * as ExtraKit from "#/ExtraKit.ts";
import { TimestampInt, UuidFromByte } from "#/internal/schema.ts";
import * as Metric from "#/Metric.ts";
import * as MetricKit from "#/MetricKit.ts";
import * as Prompt from "#/Prompt.ts";
import * as Response from "#/Response.ts";
import * as Toolkit from "#/Toolkit.ts";
import * as Trajectory from "#/Trajectory.ts";
import { TrajectoryError } from "#/TrajectoryError.ts";

/** The `extra` field, which a stored part may leave out. */
const extraField = <K extends ExtraKit.Any, P extends Extra.Part>(extrakit: K, part: P) =>
  Extra.ExtraRecord(extrakit, part).pipe(Schema.withDecodingDefault(Effect.succeed({})));

/** The meta of a prompt part, which a scan reads alone. */
type PromptPartMeta = Pick<
  Trajectory.PromptPart<ExtraKit.Any>,
  "_tag" | "uuid" | "sessionId" | "timestamp" | "startTimestamp"
>;

/** The messages and extras of a prompt part, stored apart from its meta. */
type PromptPartBody<K extends ExtraKit.Any> = Pick<Trajectory.PromptPart<K>, "messages" | "extra">;

/** A prompt part's meta as stored, which a scan reads alone. */
export interface PromptPartMetaEncoded {
  _tag: "Prompt";
  uuid: Uint8Array;
  sessionId?: string;
  timestamp?: number;
  startTimestamp?: number;
}

/** The messages and extras of a prompt part, stored apart from its meta. */
export interface PromptPartBodyEncoded {
  messages: Prompt.MessageEncoded[];
  extra?: Extra.ExtraRecordEncoded<ExtraKit.Extras<ExtraKit.Any>, "prompt">;
}

const promptMetaFields = {
  _tag: Schema.tag("Prompt"),
  uuid: UuidFromByte,
  sessionId: Schema.optional(Schema.String),
  timestamp: Schema.optional(TimestampInt),
  startTimestamp: Schema.optional(TimestampInt),
};

export const PromptPartMeta: Schema.Codec<PromptPartMeta, PromptPartMetaEncoded> = Schema.Struct(
  promptMetaFields,
).annotate({ identifier: "PromptPartMeta" });

const promptBodyFields = <K extends ExtraKit.Any>(extrakit: K) => ({
  messages: Prompt.Message.pipe(Schema.Array, Schema.mutable),
  extra: extraField(extrakit, "prompt"),
});

export const PromptPartBody = <K extends ExtraKit.Any>(
  extrakit: K,
): Schema.Codec<PromptPartBody<K>, PromptPartBodyEncoded> =>
  Schema.Struct(promptBodyFields(extrakit)).annotate({ identifier: "PromptPartBody" });

/** Both halves as one struct, which `encodePart` writes as one binary value. */
export const PromptPart = <K extends ExtraKit.Any>(
  extrakit: K,
): Schema.Codec<Trajectory.PromptPart<K>, PromptPartMetaEncoded & PromptPartBodyEncoded> =>
  Schema.Struct({ ...promptMetaFields, ...promptBodyFields(extrakit) }).annotate({
    identifier: "PromptPart",
  });

/** The meta of a session part, which a scan reads alone. */
type SessionPartMeta = Pick<Trajectory.SessionPart<ExtraKit.Any>, "_tag" | "uuid" | "type">;

/** The extras of a session part, stored apart from its meta. */
type SessionPartBody<K extends ExtraKit.Any> = Pick<Trajectory.SessionPart<K>, "extra">;

/** A session part's meta as stored, which a scan reads alone. */
export interface SessionPartMetaEncoded {
  _tag: "Session";
  uuid: Uint8Array;
  type: { _tag: "main" } | { _tag: "sub"; id: string; fork: Uint8Array };
}

/** The extras of a session part, stored apart from its meta. */
export interface SessionPartBodyEncoded {
  extra?: Extra.ExtraRecordEncoded<ExtraKit.Extras<ExtraKit.Any>, "session">;
}

const MainSessionEncoded = Schema.TaggedStruct("main", {});

const SubSessionEncoded = Schema.TaggedStruct("sub", { id: Schema.String, fork: UuidFromByte });

/**
 * The declaration a session part states, which the stored type decodes to. It is
 * stated here because the part schema is generic in the extras it reads.
 */
const SessionTypeDecoded = Schema.Union([
  Schema.TaggedStruct("main", { id: Schema.Literal(Trajectory.mainSessionId) }),
  Schema.TaggedStruct("sub", { id: Schema.String, fork: Schema.String }),
]);

const SessionType = Schema.Union([MainSessionEncoded, SubSessionEncoded]).pipe(
  Schema.decodeTo(SessionTypeDecoded, {
    decode: SchemaGetter.transform((stored) =>
      Match.value(stored).pipe(
        Match.tag("main", () => ({ ...Trajectory.mainSession })),
        Match.tag("sub", (sub) => Trajectory.subSession(sub.id, { fork: sub.fork })),
        Match.exhaustive,
      ),
    ),
    encode: SchemaGetter.transform((session) =>
      Match.value(session).pipe(
        Match.tag("main", () => MainSessionEncoded.make({})),
        Match.tag("sub", (sub) => SubSessionEncoded.make({ id: sub.id, fork: sub.fork })),
        Match.exhaustive,
      ),
    ),
  }),
);

const sessionMetaFields = {
  _tag: Schema.tag("Session"),
  uuid: UuidFromByte,
  type: SessionType,
};

export const SessionPartMeta: Schema.Codec<SessionPartMeta, SessionPartMetaEncoded> = Schema.Struct(
  sessionMetaFields,
).annotate({ identifier: "SessionPartMeta" });

const sessionBodyFields = <K extends ExtraKit.Any>(extrakit: K) => ({
  extra: extraField(extrakit, "session"),
});

export const SessionPartBody = <K extends ExtraKit.Any>(
  extrakit: K,
): Schema.Codec<SessionPartBody<K>, SessionPartBodyEncoded> =>
  Schema.Struct(sessionBodyFields(extrakit)).annotate({ identifier: "SessionPartBody" });

/** Both halves as one struct, which `encodePart` writes as one binary value. */
export const SessionPart = <K extends ExtraKit.Any>(
  extrakit: K,
): Schema.Codec<Trajectory.SessionPart<K>, SessionPartMetaEncoded & SessionPartBodyEncoded> =>
  Schema.Struct({ ...sessionMetaFields, ...sessionBodyFields(extrakit) }).annotate({
    identifier: "SessionPart",
  });

/** The meta of a response part, which a scan reads alone. */
type ResponsePartMeta = Pick<
  Trajectory.ResponsePart<Toolkit.Any, ExtraKit.Any>,
  "_tag" | "uuid" | "sessionId" | "timestamp" | "startTimestamp"
>;

/** The response and extras of a response part, stored apart from its meta. */
type ResponsePartBody<T extends Toolkit.Any, K extends ExtraKit.Any> = Pick<
  Trajectory.ResponsePart<T, K>,
  "response" | "extra"
>;

/** A response part's meta as stored, which a scan reads alone. */
export interface ResponsePartMetaEncoded {
  _tag: "Response";
  uuid: Uint8Array;
  sessionId?: string;
  timestamp: number;
  startTimestamp?: number;
}

/** The response and extras of a response part, stored apart from its meta. */
export interface ResponsePartBodyEncoded {
  response: Response.PartEncoded;
  extra?: Extra.ExtraRecordEncoded<ExtraKit.Extras<ExtraKit.Any>, "response">;
}

/** The response part of a toolkit, or the part that names no tool. */
const responseParts = <T extends Toolkit.Any>(toolkit: T) =>
  Schema.Union([Response.Part(toolkit), Response.Part()]);

type ResponseParts<T extends Toolkit.Any> = ReturnType<typeof responseParts<T>>;

const responseMetaFields = {
  _tag: Schema.tag("Response"),
  uuid: UuidFromByte,
  sessionId: Schema.optional(Schema.String),
  timestamp: TimestampInt,
  startTimestamp: Schema.optional(TimestampInt),
};

export const ResponsePartMeta: Schema.Codec<ResponsePartMeta, ResponsePartMetaEncoded> =
  Schema.Struct(responseMetaFields).annotate({ identifier: "ResponsePartMeta" });

const responseBodyFields = <T extends Toolkit.Any, K extends ExtraKit.Any>(
  toolkit: T,
  extrakit: K,
) => ({
  response: responseParts(toolkit),
  extra: extraField(extrakit, "response"),
});

export const ResponsePartBody = <T extends Toolkit.Any, K extends ExtraKit.Any>(
  toolkit: T,
  extrakit: K,
): Schema.Codec<
  ResponsePartBody<T, K>,
  ResponsePartBodyEncoded,
  Schema.Codec.DecodingServices<ResponseParts<T>>,
  Schema.Codec.EncodingServices<ResponseParts<T>>
> =>
  Schema.Struct(responseBodyFields(toolkit, extrakit)).annotate({
    identifier: "ResponsePartBody",
  });

/** Both halves as one struct, which `encodePart` writes as one binary value. */
export const ResponsePart = <T extends Toolkit.Any, K extends ExtraKit.Any>(
  toolkit: T,
  extrakit: K,
): Schema.Codec<
  Trajectory.ResponsePart<T, K>,
  ResponsePartMetaEncoded & ResponsePartBodyEncoded,
  Schema.Codec.DecodingServices<ResponseParts<T>>,
  Schema.Codec.EncodingServices<ResponseParts<T>>
> =>
  Schema.Struct({ ...responseMetaFields, ...responseBodyFields(toolkit, extrakit) }).annotate({
    identifier: "ResponsePart",
  });

/** The meta of an event part, which a scan reads alone. */
type EventPartMeta = Pick<
  Trajectory.EventPart<EventKit.Any>,
  "_tag" | "uuid" | "sessionId" | "timestamp" | "startTimestamp"
>;

/** The event an event part carries, stored apart from its meta. */
type EventPartBody<K extends EventKit.Any> = Pick<Trajectory.EventPart<K>, "event">;

/** An event part's meta as stored, which a scan reads alone. */
export interface EventPartMetaEncoded {
  _tag: "Event";
  uuid: Uint8Array;
  sessionId?: string;
  timestamp: number;
  startTimestamp?: number;
}

/**
 * The event a kit reads, stored apart from the meta. The payload stays `unknown`
 * here, because the kit states its type.
 */
export interface EventPartBodyEncoded {
  event: { _tag: string; data: unknown };
}

const eventMetaFields = {
  _tag: Schema.tag("Event"),
  uuid: UuidFromByte,
  sessionId: Schema.optional(Schema.String),
  timestamp: TimestampInt,
  startTimestamp: Schema.optional(TimestampInt),
};

export const EventPartMeta: Schema.Codec<EventPartMeta, EventPartMetaEncoded> = Schema.Struct(
  eventMetaFields,
).annotate({ identifier: "EventPartMeta" });

const eventBodyFields = <K extends EventKit.Any>(eventkit: K) => ({
  event: Event.EventParts(eventkit),
});

export const EventPartBody = <K extends EventKit.Any>(
  eventkit: K,
): Schema.Codec<
  EventPartBody<K>,
  EventPartBodyEncoded,
  Schema.Codec.DecodingServices<ReturnType<typeof Event.EventParts<K>>>,
  Schema.Codec.EncodingServices<ReturnType<typeof Event.EventParts<K>>>
> => Schema.Struct(eventBodyFields(eventkit)).annotate({ identifier: "EventPartBody" });

/** Both halves as one struct, which `encodePart` writes as one binary value. */
export const EventPart = <K extends EventKit.Any>(
  eventkit: K,
): Schema.Codec<
  Trajectory.EventPart<K>,
  EventPartMetaEncoded & EventPartBodyEncoded,
  Schema.Codec.DecodingServices<ReturnType<typeof Event.EventParts<K>>>,
  Schema.Codec.EncodingServices<ReturnType<typeof Event.EventParts<K>>>
> =>
  Schema.Struct({ ...eventMetaFields, ...eventBodyFields(eventkit) }).annotate({
    identifier: "EventPart",
  });

/** A metric part's meta as stored, which a scan reads alone. */
export interface MetricPartMetaEncoded {
  _tag: "Metric";
  metricTag: string;
  attach?: NonEmptyReadonlyArray<Uint8Array>;
  timestamp?: number;
  startTimestamp?: number;
}

/**
 * The one meta that is not a subset of its part. The tag and the attach list are
 * lifted out of the part's metric, so a reader learns what a result attaches to
 * without reading the body.
 */
export interface MetricPartMeta {
  readonly _tag: "Metric";
  readonly metricTag: string;
  readonly attach?: NonEmptyReadonlyArray<string>;
  readonly timestamp?: DateTime.Utc;
  readonly startTimestamp?: DateTime.Utc;
}

const metricMetaFields = {
  _tag: Schema.tag("Metric"),
  metricTag: Schema.TemplateLiteral([Schema.String, "/", Schema.String]),
  attach: Schema.optional(Schema.NonEmptyArray(UuidFromByte)),
  timestamp: Schema.optional(TimestampInt),
  startTimestamp: Schema.optional(TimestampInt),
};

export const MetricPartMeta: Schema.Codec<MetricPartMeta, MetricPartMetaEncoded> = Schema.Struct(
  metricMetaFields,
).annotate({ identifier: "MetricPartMeta" });

/**
 * The results a metric kit reads, stored apart from the meta. The payload stays
 * `unknown` here, because the kit states its type.
 */
export interface MetricPartBodyEncoded {
  data: unknown;
}

/** The results of the metrics a kit declares, each without the attach list. */
const metricResults = <K extends MetricKit.Any>(metrickit: K) =>
  Schema.Union(
    Metric.MetricParts(metrickit).members.map((part) =>
      part.fields.data.mapMembers((members) =>
        members.map((member) =>
          Schema.toEncoded(member.mapFields(({ attach: _attach, ...rest }) => rest)),
        ),
      ),
    ),
  );

const metricBodyFields = <K extends MetricKit.Any>(metrickit: K) => ({
  data: metricResults(metrickit),
});

export const MetricPartBody = <K extends MetricKit.Any>(
  metrickit: K,
): Schema.Codec<
  MetricPartBodyEncoded,
  MetricPartBodyEncoded,
  Schema.Codec.DecodingServices<ReturnType<typeof Metric.MetricParts<K>>>,
  Schema.Codec.EncodingServices<ReturnType<typeof Metric.MetricParts<K>>>
> => Schema.Struct(metricBodyFields(metrickit)).annotate({ identifier: "MetricPartBody" });

/**
 * The metric part as read, whose timestamps are moments by then. The epochs are
 * the meta's business alone.
 */
const readMetricPart = <K extends MetricKit.Any>(metrickit: K) =>
  Trajectory.MetricPart(metrickit).mapFields((fields) => ({
    ...fields,
    timestamp: Schema.optional(Schema.toType(TimestampInt)),
    startTimestamp: Schema.optional(Schema.toType(TimestampInt)),
  }));

/** The metric part as stored, which states the meta's fields beside the body's results. */
const storedMetricPart = <K extends MetricKit.Any>(metrickit: K) =>
  Schema.Struct({ ...metricMetaFields, ...metricBodyFields(metrickit) });

/**
 * Reads the stored struct as the part. The meta's tag and attach list name the
 * metric whose result the body holds, so they go into its metric.
 */
export const decodeMetricPart = <K extends MetricKit.Any>({
  _tag,
  metricTag,
  attach,
  data,
  timestamp,
  startTimestamp,
}: MetricPartMeta & MetricPartBodyEncoded) =>
  // SAFETY: the meta names the metric whose result the body holds;
  // stored apart, no type pairs them.
  ({
    _tag,
    metric: {
      _tag: metricTag,
      data: attach === undefined ? data : { ...(data as object), attach },
    },
    timestamp,
    startTimestamp,
  }) as Schema.Codec.Encoded<ReturnType<typeof readMetricPart<K>>>;

/** Reads the part back as the stored struct, taking the attach list out of its metric. */
const encodeMetricPart = <K extends MetricKit.Any>({
  _tag,
  metric,
  timestamp,
  startTimestamp,
}: Schema.Codec.Encoded<ReturnType<typeof readMetricPart<K>>>) => {
  const { attach, ...data } = metric.data;

  return { _tag, metricTag: metric._tag, attach, timestamp, startTimestamp, data };
};

/**
 * The metric part, whose stored form states its tag and attach list in the meta
 * rather than in its metric.
 */
export const MetricPart = <K extends MetricKit.Any>(
  metrickit: K,
): Schema.Codec<
  Trajectory.MetricPart<K>,
  MetricPartMetaEncoded & MetricPartBodyEncoded,
  Schema.Codec.DecodingServices<ReturnType<typeof Metric.MetricParts<K>>>,
  Schema.Codec.EncodingServices<ReturnType<typeof Metric.MetricParts<K>>>
> =>
  storedMetricPart(metrickit)
    .annotate({ identifier: "MetricPart" })
    .pipe(
      Schema.decodeTo(readMetricPart(metrickit), {
        decode: SchemaGetter.transform(decodeMetricPart<K>),
        encode: SchemaGetter.transform(encodeMetricPart),
      }),
    );

/**
 * Every meta a frame may hold, read with no config. The header and the footer state
 * no meta, because each is a message of its own.
 */
export const Meta = Schema.Union([
  PromptPartMeta,
  SessionPartMeta,
  ResponsePartMeta,
  EventPartMeta,
  MetricPartMeta,
]).annotate({ identifier: "Meta" });

export type Meta = Schema.Schema.Type<typeof Meta>;

/** The parts a config reads, each with the config's own kits. */
const configParts = <C extends Config.AnyConfig>(config: C) =>
  Schema.Union([
    PromptPart(config.extrakit),
    SessionPart(config.extrakit),
    ResponsePart(config.toolkit, config.extrakit),
    EventPart(config.eventkit),
    MetricPart(config.metrickit),
  ]);

type ConfigParts<C extends Config.AnyConfig> = ReturnType<typeof configParts<C>>;

/** The part of any kind, of which a stored trajectory is a sequence. */
export const Part = <C extends Config.AnyConfig>(
  config: C,
): Schema.Codec<
  Trajectory.Part<C>,
  Schema.Codec.Encoded<ConfigParts<C>>,
  Config.DecodingServices<C>,
  Config.EncodingServices<C>
> =>
  // SAFETY: every member reads one kind with the config's own kits, so the
  // config's services cover them.
  // Effect omits tool parameter services from response part types; see
  // https://github.com/Effect-TS/effect/issues/9867.
  configParts(config) as Schema.Codec<
    Trajectory.Part<C>,
    Schema.Codec.Encoded<ConfigParts<C>>,
    Config.DecodingServices<C>,
    Config.EncodingServices<C>
  >;

/** The part as the one binary value a cache stores. */
export const encodePart = <C extends Config.AnyConfig>(config: C) => {
  const encode = Part(config).pipe(SchemaBinary.toCodec, Schema.encodeEffect);

  return (
    part: Trajectory.Part<C>,
  ): Effect.Effect<Uint8Array, TrajectoryError, Config.EncodingServices<C>> =>
    encode(part).pipe(
      Effect.mapError(TrajectoryError.parse),
      // The codec writes into an arena it shares, so the store takes its own copy.
      Effect.map((bytes) => bytes.slice()),
    );
};

/** Reads the one binary value a cache stores as the part it holds. */
export const decodePart = <C extends Config.AnyConfig>(config: C) => {
  const decode = Part(config).pipe(SchemaBinary.toCodec, Schema.decodeUnknownEffect);

  return (
    bytes: Uint8Array,
  ): Effect.Effect<Trajectory.Part<C>, TrajectoryError, Config.DecodingServices<C>> =>
    decode(bytes).pipe(Effect.mapError(TrajectoryError.parse));
};
