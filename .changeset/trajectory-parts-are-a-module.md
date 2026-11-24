---
"@trajs/core": minor
---

Trajectory parts are a module of `@trajs/core` rather than members of `Trajectory`:
the part schemas, the session declarations, and the builders `parts` returns are in
`TrajectoryPart`, imported as `@trajs/core/TrajectoryPart` or as the `TrajectoryPart`
namespace of the package. `Trajectory` keeps the named stream, its buffer, `asStream`,
and `make`.

`Config` is `TrajectoryConfig`, imported as `@trajs/core/TrajectoryConfig` or as the
`TrajectoryConfig` namespace of the package. It also states the part of one config, so
`PromptPartOf`, `SessionPartOf`, `ResponsePartOf`, `EventPartOf`, and `MetricPartOf` sit
beside the config they read rather than beside the parts.
