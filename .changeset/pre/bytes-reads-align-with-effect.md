---
"@trajs/utils": minor
---

`Bytes` re-exports the `Uint8Array` utilities of `effect/Bytes`, so `Bytes.concat`,
`Bytes.Equivalence` and `Bytes.Order` are the ones Effect states rather than a copy of
them. `Bytes.concat` takes a `ReadonlyArray<Uint8Array>`.

`Bytes.readAlloc` yields `Option.Option<Uint8Array>`, which is `Option.none()` where the
sequence holds no byte at the offset, as `FileSystem.File.readAlloc` yields at the end of a
file. A reader matches on the option instead of telling an empty buffer from the end of the
sequence.
