import { Effect, Predicate, Result, Stream } from "effect";

import type * as Cache from "#/Cache.ts";
import * as Trajectory from "#/Trajectory.ts";
import type * as TrajectoryConfig from "#/TrajectoryConfig.ts";
import type { TrajectoryError } from "#/TrajectoryError.ts";
import type * as TrajectoryPart from "#/TrajectoryPart.ts";
import type * as MetricView from "#/view/MetricView.ts";

/** What one reading of a cached trajectory fails with. */
type ReadError = TrajectoryError | Cache.CacheError;

/** The cached parts of a trajectory, read by index or as a stream. */
type Parts<Config extends TrajectoryConfig.AnyConfig> = Trajectory.TrajectoryBuffer<
  Config,
  ReadError,
  TrajectoryConfig.DecodingServices<Config>
>;

/** A reading of a cached trajectory, which fails wherever the cache does. */
type Reading<Config extends TrajectoryConfig.AnyConfig, A> = Effect.Effect<
  A,
  ReadError,
  TrajectoryConfig.DecodingServices<Config>
>;

/** A metric view stream of a cached trajectory. */
type MetricStream<Config extends TrajectoryConfig.AnyConfig> = MetricView.MetricTrajectoryStream<
  Config,
  ReadError,
  TrajectoryConfig.DecodingServices<Config>
>;

/** The metric parts attached to each part, by the uuid of the part they name. */
type Attachment<Config extends TrajectoryConfig.AnyConfig> = ReadonlyMap<
  string,
  ReadonlyArray<TrajectoryConfig.MetricPartOf<Config>>
>;

const isMetric = <Config extends TrajectoryConfig.AnyConfig>(
  part: TrajectoryPart.Part<Config>,
): part is TrajectoryConfig.MetricPartOf<Config> => Predicate.isTagged("Metric")(part);

/**
 * The metric parts `cached` holds, by the uuid of the part each attaches to.
 *
 * A result that names one target twice attaches once.
 */
const attachments = <Config extends TrajectoryConfig.AnyConfig>(
  cached: Parts<Config>,
): Reading<Config, Attachment<Config>> =>
  Effect.gen(function* () {
    // One reading per call, so reading the view again starts from no entries.
    const attached = new Map<string, Array<TrajectoryConfig.MetricPartOf<Config>>>();

    yield* Trajectory.asStream(cached).pipe(
      Stream.filter(isMetric),
      Stream.runForEach((result) =>
        Effect.sync(() => {
          for (const target of new Set(result.metric.data.attach ?? [])) {
            const held = attached.get(target);

            if (held === undefined) {
              attached.set(target, [result]);
            } else {
              held.push(result);
            }
          }
        }),
      ),
    );

    return attached;
  });

/** Groups the results of one part by metric tag, each list in trajectory order. */
const groupByTag = <Config extends TrajectoryConfig.AnyConfig>(
  results: ReadonlyArray<TrajectoryConfig.MetricPartOf<Config>>,
): MetricView.AttachedMetrics<Config> => {
  const grouped = new Map<string, Array<TrajectoryConfig.MetricPartOf<Config>>>();

  for (const result of results) {
    const tag = result.metric._tag;
    const held = grouped.get(tag);

    if (held === undefined) {
      grouped.set(tag, [result]);
    } else {
      held.push(result);
    }
  }

  // SAFETY: each list holds the results of the metric its key names, in trajectory order,
  // which is what the record holds and all it holds. The tags of a config are not known
  // one by one where the config is a type parameter, so the groups cannot be read as the
  // record by type alone.
  return Object.fromEntries<unknown>(grouped) as MetricView.AttachedMetrics<Config>;
};

/**
 * The part with the results attached to it.
 *
 * A result that names a target is dropped, since that target carries it, and a
 * result that names none is a part of its own.
 */
const emit = <Config extends TrajectoryConfig.AnyConfig>(
  attached: Attachment<Config>,
  part: TrajectoryPart.Part<Config>,
): Result.Result<MetricView.MetricTrajectoryPart<Config>, void> => {
  if (isMetric(part)) {
    return part.metric.data.attach === undefined ? Result.succeed(part) : Result.failVoid;
  }

  return Result.succeed({ ...part, metrics: groupByTag(attached.get(part.uuid) ?? []) });
};

/** Reads the parts of a cached trajectory with the results attached to each of them. */
export const metricStream = <Config extends TrajectoryConfig.AnyConfig>(
  cached: Parts<Config>,
): Reading<Config, MetricStream<Config>> =>
  Effect.map(attachments(cached), (attached) =>
    Trajectory.asStream(cached).pipe(Stream.filterMap((part) => emit(attached, part))),
  );
