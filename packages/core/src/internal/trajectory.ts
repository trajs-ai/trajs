import { v7 } from "uuid";

import type * as TrajectoryConfig from "#/TrajectoryConfig.ts";

/** A new uuid v7, which names a trajectory or a part of one. */
export const uuid = (): string => v7();

/** A trajectory value, which carries the id it is named by and the config it is read with. */
type Named<
  Id extends string,
  Config extends TrajectoryConfig.AnyConfig,
  Value extends object,
> = Value & Readonly<{ id: Id }> & Readonly<Config>;

/**
 * Names `value` with `id` and reads it with `config`.
 *
 * A stream and a buffer are opaque objects that carry methods of their own, so the
 * fields are set on the value rather than on a copy.
 */
export const attach =
  <Id extends string, Config extends TrajectoryConfig.AnyConfig>(id: Id, config: Config) =>
  <Value extends object>(value: Value): Named<Id, Config, Value> =>
    Object.assign(value, config, { id });

export const configOf = <Config extends TrajectoryConfig.AnyConfig>(
  trajectory: Readonly<Config>,
): Config =>
  // SAFETY: these fields are the config. The trajectory carries that config.
  ({
    toolkit: trajectory.toolkit,
    eventkit: trajectory.eventkit,
    metrickit: trajectory.metrickit,
    extrakit: trajectory.extrakit,
  }) as Config;
