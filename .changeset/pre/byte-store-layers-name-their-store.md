---
"@trajs/utils": minor
---

`ByteStore.layerMemory` replaces `ByteStore.layer`, so the store a program keeps
in memory is named after where it keeps the bytes, as `ByteStore.layerFileSystem`
and `ByteStore.layerS3` are.

`ByteStore.layerFileSystem` replaces `ByteStore.layerFsTemp` and takes a directory.
A directory stated alone is `dir`, so `ByteStore.layerFileSystem("bytes")` and
`ByteStore.layerFileSystem({ dir: "bytes", chunkSize: 4 })` build the same layer.
A directory left unstated is a temporary one, made for the scope of the layer,
which is what `layerFsTemp` always did.
