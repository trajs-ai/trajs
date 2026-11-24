import { Effect, Predicate, Stream } from "effect";

import type { Any, MetricParts, Producer, Failure } from "#/Metric.ts";
import type { Producers } from "#/MetricKit.ts";
import type * as Trajectory from "#/Trajectory.ts";
// `MetricKit` reads `MetricSchema` while it loads, and this module loads before
// it, so `TrajectoryConfig` stays a type here.
import type * as TrajectoryConfig from "#/TrajectoryConfig.ts";
import type { TrajectoryError } from "#/TrajectoryError.ts";

const isFailure = (value: unknown): value is Failure<Any> =>
  Predicate.isTagged("Failure")(value) && Predicate.hasProperty(value, "failure");

/**
 * Runs every producer of `producers` over one reading of `produced`, under the
 * tag of the metric each reports.
 */
export const runProducers = <
  Metrics extends Record<string, Any>,
  Config extends TrajectoryConfig.AnyConfig,
  E,
  R,
>(
  producers: Producers<Metrics>,
  produced: Trajectory.TrajectoryStream<Config, E, R>,
): Stream.Stream<MetricParts<Metrics>, E | TrajectoryError, R> => {
  const tags = Object.keys(producers);

  if (tags.length === 0) {
    return Stream.empty;
  }

  // The record is read by a tag computed at runtime, so each producer is taken as
  // the producer of any metric.
  const producersByTag: Readonly<Record<string, Producer<Any>>> = producers;

  // SAFETY: each result is tagged with the producer that reported it, and `Producers`
  // holds one producer per metric, so the merged stream holds one part per metric.
  // The tag is a runtime string, so no type correlates it with the metric it names.
  return produced.pipe(
    Stream.broadcastN({ n: tags.length, capacity: "unbounded" }),
    Effect.map((streams) =>
      Stream.mergeAll(
        tags.map((tag, index) =>
          producersByTag[tag](streams[index]).pipe(
            Stream.map((reported) => ({ _tag: tag, data: reported })),
            Stream.catchIf(isFailure, (failure) => Stream.make({ _tag: tag, data: failure })),
          ),
        ),
        { concurrency: "unbounded" },
      ),
    ),
    Stream.unwrap,
  ) as Stream.Stream<MetricParts<Metrics>, E | TrajectoryError, R>;
};
