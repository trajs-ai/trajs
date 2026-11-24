---
"@trajs/utils": minor
---

`Bytes` replaces `Byte`, so the sequence a trajectory is read through is named
after what it holds.

It is the subpath import `@trajs/utils/Bytes` and the type of the sequence,
`Bytes`. `Bytes.make`, `Bytes.makeFromBuffer`, `Bytes.makeFromFile` and
`Bytes.concat` read what they read before.

`ByteStore.read` serves the bytes it keeps as `Bytes`.
