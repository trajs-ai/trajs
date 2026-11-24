/**
 * A named stream of parts, read with one config.
 *
 * {@link make} binds an id and a config to a stream of {@link TrajectoryPart.Part}.
 * {@link asStream} reads the parts of a buffer in order.
 * {@link TrajectoryPart.parts} builds those parts.
 *
 * @stability stable
 */

import { Effect, Option, Result, Stream } from "effect";

import { attach, uuid } from "#/internal/trajectory.ts";
import type * as TrajectoryConfig from "#/TrajectoryConfig.ts";
import type * as TrajectoryPart from "#/TrajectoryPart.ts";

/**
 * A stream of {@link TrajectoryPart.Part} for `Config`, before an id is bound.
 *
 * @see {@link Trajectory} for the named stream.
 * @stability stable
 * @category models
 */
export type TrajectoryStream<
  Config extends TrajectoryConfig.AnyConfig,
  E = never,
  R = never,
> = Stream.Stream<TrajectoryPart.Part<Config>, E, R>;

/**
 * The parts of a trajectory held by index, read with `Config`.
 *
 * **When to use**
 *
 * Use when the parts are already read and a caller needs their count, one part
 * by index, and the parts as a stream.
 *
 * **Details**
 *
 * `length` counts the parts held.
 * `at` reads the part at a zero-based index.
 * A negative index and an index past the end hold nothing, so `at` returns `none`.
 * `E` and `R` are the error and the requirements of one read.
 *
 * @see {@link asStream} for reading those parts as a stream.
 * @see {@link TrajectoryFile} for a whole trajectory of those parts.
 * @stability stable
 * @category models
 */
export interface TrajectoryBuffer<Config extends TrajectoryConfig.AnyConfig, E = never, R = never> {
  readonly length: number;
  readonly at: (index: number) => Effect.Effect<Option.Option<TrajectoryPart.Part<Config>>, E, R>;
}

/**
 * Reads the parts of a {@link TrajectoryBuffer} as a {@link TrajectoryStream}.
 *
 * **Details**
 *
 * The stream reads `at(0)` through `at(length - 1)` in order, one part at a time.
 * An index that holds nothing is skipped.
 * The length is read where the stream runs, not where it is built.
 *
 * @see {@link TrajectoryBuffer} for the parts the stream reads.
 * @see {@link make} for naming the stream with an id and its config.
 * @stability stable
 * @category constructors
 */
export const asStream = <Config extends TrajectoryConfig.AnyConfig, E = never, R = never>(
  buffer: TrajectoryBuffer<Config, E, R>,
): TrajectoryStream<Config, E, R> =>
  Stream.suspend(() => Stream.range(0, buffer.length - 1)).pipe(
    Stream.mapEffect((index) => buffer.at(index)),
    Stream.filterMap((part) =>
      Option.isSome(part) ? Result.succeed(part.value) : Result.failVoid,
    ),
  );

/**
 * A stream of {@link TrajectoryPart.Part} named by `Id` and read with `Config`.
 *
 * **Details**
 *
 * `E` and `R` are the error and the requirements of the stream.
 *
 * @see {@link make} for binding the id and the config.
 * @see {@link TrajectoryStream} for the stream before that binding.
 * @stability stable
 * @category models
 */
export type Trajectory<
  Id extends string = string,
  Config extends TrajectoryConfig.AnyConfig = TrajectoryConfig.AnyConfig,
  E = never,
  R = never,
> = TrajectoryStream<Config, E, R> & Readonly<{ id: Id }> & Readonly<Config>;

/**
 * A whole trajectory, addressed by index the way a file is.
 *
 * **When to use**
 *
 * Use when a caller reads a part at any index, not the parts in order.
 *
 * **Details**
 *
 * `at` reaches a part without reading the parts before it.
 *
 * @see {@link TrajectoryBuffer} for those parts without an id or a config.
 * @see {@link Trajectory} for the same id and config over a stream, read in order.
 * @see {@link asStream} for reading those parts in order.
 * @stability stable
 * @category models
 */
export type TrajectoryFile<
  Id extends string = string,
  Config extends TrajectoryConfig.AnyConfig = TrajectoryConfig.AnyConfig,
  E = never,
  R = never,
> = TrajectoryBuffer<Config, E, R> & Readonly<{ id: Id }> & Readonly<Config>;

/**
 * Creates a {@link Trajectory} from a part stream, named by an id and read with `config`.
 *
 * **When to use**
 *
 * Use when a part stream should carry its id and its config.
 *
 * **Details**
 *
 * `make(id, config)(stream)` keeps the given id.
 * `make(config)(stream)` assigns a new uuid v7.
 * The result is the stream plus `id` and the fields of `config`.
 * `stream.pipe(make(config))` binds the same way.
 *
 * **Gotchas**
 *
 * `make` does not read the stream.
 * Each `make(config)` call assigns a different id.
 *
 * **Example** (Naming a trajectory)
 *
 * ```ts
 * import { Stream } from "effect"
 * import { Prompt, Trajectory, TrajectoryConfig, TrajectoryPart } from "@trajs/core"
 *
 * const config = TrajectoryConfig.config()
 * const part = TrajectoryPart.parts(config)
 * const trajectory = Trajectory.make("run-1", config)(
 *   Stream.make(part.prompt(Prompt.make("Hello"))),
 * )
 *
 * trajectory.id // => "run-1"
 * ```
 *
 * @see {@link TrajectoryPart.parts} for building the parts.
 * @see {@link Trajectory} for the bound stream.
 * @stability stable
 * @category constructors
 */
export function make<Id extends string, Config extends TrajectoryConfig.AnyConfig>(
  id: Id,
  config: Config,
): <E, R>(stream: TrajectoryStream<Config, E, R>) => Trajectory<Id, Config, E, R>;
export function make<Config extends TrajectoryConfig.AnyConfig>(
  config: Config,
): <E, R>(stream: TrajectoryStream<Config, E, R>) => Trajectory<string, Config, E, R>;
export function make<Config extends TrajectoryConfig.AnyConfig>(
  ...args: [id: string, config: Config] | [config: Config]
) {
  if (args.length === 1) {
    const [config] = args;

    return attach(uuid(), config);
  }

  const [id, config] = args;

  return attach(id, config);
}
