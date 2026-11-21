---
"@trajs/core": minor
---

`Session.main` reads a `Trajectory.TrajectoryBuffer` rather than a `Trajectory`, and
no longer requires `Cache.Cache` or `Config.SchemaServices`. Reading a trajectory
into that buffer is the caller's step, so where its parts are kept is no longer a
decision of the session read: `Cache.cache` answers a buffer held in memory or read
from a store, and a caller that already holds the parts states `length` and `at`
itself.

Session streams read that buffer again on every replay, so a buffer a cache keeps
replays the way it did before. The buffer states its own failure and its own
requirements, so a buffer read through `Cache.layerKVStore` still fails with
`Cache.CacheError` and still decodes with `Config.DecodingServices`.
