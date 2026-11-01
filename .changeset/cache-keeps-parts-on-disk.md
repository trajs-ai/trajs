---
"@trajs/core": minor
---

`Cache.layerFileSystem` provides the `Cache.Cache` of `@trajs/core` over a
directory of the file system, with no `KeyValueStore` stated of the program. A part is kept
as one file named after its `<id>/<index>` key, and `capacity` bounds the decoded parts held
in memory, as `Cache.layerKVStore` does. A directory left unstated is a temporary one, made
for the scope of the layer.
