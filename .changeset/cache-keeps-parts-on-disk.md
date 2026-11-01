---
"@trajs/core": minor
---

`Cache.layerFileSystem` provides the `Cache.Cache` of `@trajs/core` over a
directory of the file system, with no `KeyValueStore` stated of the program. A part is kept
as one file named after its `<id>/<index>` key.

The directory is stated alone or beside the `capacity` of the memory:
`Cache.layerFileSystem("parts")` and
`Cache.layerFileSystem({ dir: "parts", capacity: 1_000 })` build the same layer. A directory
left unstated is a temporary one, made for the scope of the layer.
