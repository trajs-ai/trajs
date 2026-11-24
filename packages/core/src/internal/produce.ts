import { Effect, Stream } from "effect";

import * as Metric from "#/Metric.ts";
import type * as MetricKit from "#/MetricKit.ts";
import * as Trajectory from "#/Trajectory.ts";
import type * as TrajectoryConfig from "#/TrajectoryConfig.ts";
import type { TrajectoryError } from "#/TrajectoryError.ts";
import * as TrajectoryPart from "#/TrajectoryPart.ts";

/** The parts of `stream` beside the metric parts its producers report of them. */
export const produceParts =
  <Config extends TrajectoryConfig.AnyConfig, Metrics extends Record<string, Metric.Any>>(
    config: Config,
    metrickit: MetricKit.WithProducers<MetricKit.MetricKit<Metrics>>,
  ) =>
  <E, R>(
    stream: Trajectory.TrajectoryStream<Config, E, R>,
  ): Stream.Stream<TrajectoryPart.Part<Config>, E | TrajectoryError, R> => {
    const parts = TrajectoryPart.parts(config);

    return stream.pipe(
      // A trajectory of a run cannot be read from its source again.
      Stream.broadcastN({ n: 2, capacity: "unbounded" }),
      Effect.map(([trajectory, copy]) =>
        Stream.merge(
          trajectory,
          copy.pipe(
            Metric.produce(metrickit),
            // SAFETY: a result the producers report is a metric of the kit they were
            // given with, and the caller gives a kit whose metrics the config's kit
            // holds. No type of either kit relates them, so the part cannot be read
            // as one of the config's metrics otherwise.
            Stream.map((metric) =>
              parts.metric(metric as Metric.MetricParts<TrajectoryConfig.MetricsOf<Config>>),
            ),
          ),
        ),
      ),
      Stream.unwrap,
    );
  };
