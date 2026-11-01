import { Compression } from "@trajs/utils";
import { Context, Effect, FileSystem, Layer, Match, Option, Path, Scope } from "effect";
import type { PlatformError } from "effect/PlatformError";
import type { JsonObject } from "effect/Schema";

import * as Config from "#/Config.ts";
import * as ExchangeIssue from "#/ExchangeIssue.ts";
import * as file from "#/internal/exchange/file.ts";
import * as Trajectory from "#/Trajectory.ts";
import { TrajectoryError } from "#/TrajectoryError.ts";

export interface Inspection {
  id: string;
  version: string;
  toolkit: Record<string, JsonObject>;
  eventkit: Record<string, JsonObject>;
  metrickit: Record<string, JsonObject>;
  extrakit: Record<string, JsonObject>;
  digest: string;
  length: number;
  fileSize: bigint;
}

export interface Exchange {
  read: <Config extends Config.AnyConfig>(
    config: Config,
  ) => <Id extends string>(
    id: Id,
  ) => Effect.Effect<
    Trajectory.TrajectoryFile<Id, Config, TrajectoryError, Config.SchemaServices<Config>>,
    TrajectoryError | ExchangeIssue.Issue,
    Config.SchemaServices<Config> | Compression.Compression
  >;

  write: <Id extends string, Config extends Config.AnyConfig, E, R>(
    trajectory: Trajectory.Trajectory<Id, Config, E, R>,
  ) => Effect.Effect<
    Trajectory.TrajectoryFile<Id, Config, TrajectoryError, Config.SchemaServices<Config>>,
    E | TrajectoryError | ExchangeIssue.Issue,
    R | Config.SchemaServices<Config>
  >;

  inspect: (id: string) => Effect.Effect<Option.Option<Inspection>, TrajectoryError>;
}

export const Exchange = Context.Service<Exchange, Exchange>("trajs/Exchange");

export const layerFileSystem = ({
  cwd,
  locate = (id) => `${id}.trajs`,
}: {
  cwd?: string;
  locate?: (id: string) => string | null;
}): Layer.Layer<Exchange, never, FileSystem.FileSystem | Path.Path | Scope.Scope> =>
  Layer.effect(
    Exchange,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const scope = yield* Effect.scope;

      // A store that reports an id absent states what a locate that names no path does.
      const absent =
        (id: string) =>
        (cause: PlatformError): TrajectoryError | ExchangeIssue.NotFound =>
          Match.value(cause.reason).pipe(
            Match.tag("NotFound", () => new ExchangeIssue.NotFound({ id })),
            Match.orElse(() => TrajectoryError.parse(cause)),
          );

      // The bytes of one trajectory, as the file serves them.
      const serve = (id: string) =>
        Effect.gen(function* () {
          const located = locate(id);

          if (located === null) {
            return yield* Effect.fail(new ExchangeIssue.NotFound({ id }));
          }

          const path =
            cwd === undefined || paths.isAbsolute(located) ? located : paths.join(cwd, located);

          const opened = yield* fs
            .open(path)
            .pipe(Effect.provideService(Scope.Scope, scope), Effect.mapError(absent(id)));

          const { size } = yield* opened.stat.pipe(Effect.mapError(TrajectoryError.parse));

          // The file serves a region in as many reads as it states.
          const read = (position: bigint, size: number) =>
            Effect.gen(function* () {
              const bytes = new Uint8Array(size);

              let filled = 0;

              while (filled < size) {
                const taken = yield* opened
                  .read(bytes.subarray(filled), { position: position + BigInt(filled) })
                  .pipe(Effect.mapError(TrajectoryError.parse));

                if (taken === 0) {
                  return yield* Effect.fail(
                    TrajectoryError.parse(new Error(`'${path}' ends before its bytes do`)),
                  );
                }

                filled += taken;
              }

              return bytes;
            });

          return { size, read };
        });

      const read =
        <C extends Config.AnyConfig>(config: C) =>
        <Id extends string>(id: Id) =>
          Effect.gen(function* () {
            const buffer = yield* file.bufferOf(
              config,
              yield* Compression.Compression,
            )(yield* serve(id));

            return { ...config, id, ...buffer };
          });

      // TODO: writing and inspecting a file.
      const unimplemented = (name: string) => Effect.die(new Error(`Exchange.${name}`));

      return {
        read,
        write: () => unimplemented("write"),
        inspect: () => unimplemented("inspect"),
      };
    }),
  );
