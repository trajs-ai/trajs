# @trajs/utils

## 0.0.0-alpha.5

### Minor Changes

- [`047e37d`](https://github.com/trajs-ai/trajs/commit/047e37d162f322a9a667fe013e558ca80d49f25e) Thanks [@observerw](https://github.com/observerw)! - `BinaryProtocol` now carries the names the Effect `Schema` module and
  `SchemaBinary` state, rather than its own: `repeat` is `array`, `repeatOf` is
  `arrayOf`, `branch` is `union`, `as` is `decodeTo`, and `message` is `toCodec`.
  `toCodec` names the same derivation as `SchemaBinary.toCodec`: fields in, one
  codec of a whole value's bytes out. Every layout still reads and writes the same
  bytes as before.

- [`aceb66b`](https://github.com/trajs-ai/trajs/commit/aceb66b85a53239da3414204bc234ff86d8bf4b5) Thanks [@observerw](https://github.com/observerw)! - `BinaryProtocol.u64` states an unsigned 64-bit integer field, read and written
  big-endian like the narrower integer fields. Its value is a `bigint`, since a
  number holds an integer exactly only up to 2^53 - 1.
  
  `BinaryProtocol.decodeTo` states the value a field's bytes hold by composing a
  schema onto the codec of the field. A code byte is read as the code it states
  and a counted run as the text it holds, while the bytes the field spans stay the
  same.
  
  `BinaryProtocol.layout` reads and writes the bytes its fields state: integers
  big-endian, a byte run of a fixed length or one counted by an earlier field, and
  any other schema as one `SchemaBinary` frame. Decoding fails where the bytes end
  inside a field or hold more than the fields state. Encoding fails where a run
  holds another number of bytes than its wire states, or a value is of another
  range than its field. A length is a number, so an eight-byte field counts no
  run.

- [`9ffc4ce`](https://github.com/trajs-ai/trajs/commit/9ffc4cef2e0498e75b54cbc421dc65eb6ffd3925) Thanks [@observerw](https://github.com/observerw)! - `ByteStore.layerMemory` replaces `ByteStore.layer`, so the store a program keeps
  in memory is named after where it keeps the bytes, as `ByteStore.layerFileSystem`
  is.
  
  `ByteStore.layerFileSystem` replaces `ByteStore.layerFsTemp` and takes a directory.
  A directory stated alone is `dir`, so `ByteStore.layerFileSystem("bytes")` and
  `ByteStore.layerFileSystem({ dir: "bytes", chunkSize: 4 })` build the same layer.
  A directory left unstated is a temporary one, made for the scope of the layer,
  which is what `layerFsTemp` always did.

- [`35853e6`](https://github.com/trajs-ai/trajs/commit/35853e654ce7d96682046b5c7d1eda17e9f3e53e) Thanks [@observerw](https://github.com/observerw)! - `Bytes` replaces `Byte`, so the sequence a trajectory is read through is named
  after what it holds.
  
  It is the subpath import `@trajs/utils/Bytes` and the type of the sequence,
  `Bytes`. `Bytes.make`, `Bytes.makeFromBuffer`, `Bytes.makeFromFile` and
  `Bytes.concat` read what they read before.
  
  `ByteStore.read` serves the bytes it keeps as `Bytes`.

- [`3a2f353`](https://github.com/trajs-ai/trajs/commit/3a2f353873e7133888131d5a88768ba5d131324a) Thanks [@observerw](https://github.com/observerw)! - `Bytes` re-exports the `Uint8Array` utilities of `effect/Bytes`, so `Bytes.concat`,
  `Bytes.Equivalence` and `Bytes.Order` are the ones Effect states rather than a copy of
  them. `Bytes.concat` takes a `ReadonlyArray<Uint8Array>`.
  
  `Bytes.readAlloc` yields `Option.Option<Uint8Array>`, which is `Option.none()` where the
  sequence holds no byte at the offset, as `FileSystem.File.readAlloc` yields at the end of a
  file. A reader matches on the option instead of telling an empty buffer from the end of the
  sequence.

- [`c396840`](https://github.com/trajs-ai/trajs/commit/c396840173c01f77317b7f985a6c87fda93d5194) Thanks [@observerw](https://github.com/observerw)! - `BinaryProtocol.Options` takes a `direction`, the end a message's fields are read
  from, defaulting to `"forward"`. A `"backward"` message reads its fields from the
  last byte, so a field states its length, its count, or its branch by a field
  declared after it. `BinaryProtocol.bytesOf` therefore sizes a region by a length
  kept at the tail, such as the trailer of a block.
  
  Writing is unchanged, because a field spans the bytes it states in either
  direction: a `"backward"` message is still written in the order its fields are
  declared. `BinaryProtocol.frame` states its length before its bytes, so a message
  read backwards holds no frame.

- [`a566ead`](https://github.com/trajs-ai/trajs/commit/a566ead936a0f90e2f0aa4ab2e3975ab1d344191) Thanks [@observerw](https://github.com/observerw)! - `VersionedSchema` and the schema of a `package.json` are stated in
  `@trajs/utils`, beside the services a trajectory is carried through.
  
  `VersionedSchema` keeps its name, so `import { VersionedSchema } from
  "@trajs/core"` reads the same module as `@trajs/utils/VersionedSchema`.
  
  The schema of a `package.json` is `Package.PackageMetadata`, where `@trajs/core`
  exported `PackageMetadata`. A declaration still states it as its
  `packageMetadata`, and `@trajs/core` re-exports `Package` as it re-exports the
  other modules of `@trajs/utils`.

- [`8537a14`](https://github.com/trajs-ai/trajs/commit/8537a14ad680e1a885de070aea5be2b5e90bd2b2) Thanks [@observerw](https://github.com/observerw)! - `Compression.make` takes a `Compression.Codec`: the frame of each algorithm its runtime writes
  and reads, and nothing of the options. The algorithm of a call, and the chunks `None` passes
  through untouched, are resolved in `@trajs/utils`, as `Checksum.make` takes a `Checksum.Codec`
  and reads the tables of that package where a runtime states no checksum.
  
  `Compression.Frame` names one direction of a frame, and `Compression.CodedAlgorithm` the
  algorithms a codec states: every algorithm except `None`, which no codec writes.
  
  `NodeCompression.layer`, `BunCompression.layer` and `BrowserCompression.layer` therefore
  state one codec per algorithm, and `NodeChecksum.layer` and `BunChecksum.layer` state the
  checksum of their runtime. `NodeCompression.compress`, `NodeCompression.decompress`,
  `NodeChecksum.of` and `BunChecksum.of` read the same frames and the same numbers as before.

- [`ab96c7e`](https://github.com/trajs-ai/trajs/commit/ab96c7e8f920c66b5fa0d10d223a529bf2f51150) Thanks [@observerw](https://github.com/observerw)! - `ByteStore.layerS3` moves to the new `@trajs/storage-s3` as `S3ByteStore.layer`, so
  the one place a bucket is reached from is a package of its own rather than the
  package every platform shares.
  
  `S3ByteStore.layer` sends its requests through the `S3Service` of
  [`@effect-aws/client-s3`](https://github.com/floydspace/effect-aws), which types the failure S3
  answers with, so a key that holds nothing is read as an id that holds nothing
  rather than by the name the SDK reports it with. `S3ByteStore.Options` names the
  bucket alone, and `@trajs/utils` no longer depends on `@aws-sdk/client-s3`.
  
  A sequence is kept as it arrives rather than once it has ended: a write sends it as the
  parts of a multipart upload as each fills, and puts it as one object where it is shorter
  than a part, so at most one part is held in memory.

- [`8537a14`](https://github.com/trajs-ai/trajs/commit/8537a14ad680e1a885de070aea5be2b5e90bd2b2) Thanks [@observerw](https://github.com/observerw)! - `StreamHash.Options` takes a `length`, the digest bytes a call reads. It is stated
  in either form, `StreamHash.digest` and `StreamHash.start`, and from 1 to the
  bytes of the algorithm: SHA-256 reads 32 bytes, BLAKE2b-512 64, and XXH64 8.
  
  A `length` below the bytes of the algorithm cuts the digest to its leading bytes,
  so a call that states `length: 8` of SHA-256 reads the first 8 bytes of the same
  digest, as 16 hex characters. A `length` beyond the algorithm raises a
  `RangeError` when the call is made, because no digest of that length exists.
  
  `StreamHash.make` builds the service from a `StreamHash.Codec`, which states the
  running digest of each algorithm and nothing of the options. The options and the
  digest bytes are resolved there, the digest is cut, and it is read as hex, so
  `NodeStreamHash.layer`, `BunStreamHash.layer` and `BrowserStreamHash.layer` state
  a running digest per algorithm only.
  
  A stored trajectory records the algorithm of its digest, not the `length` of the
  call that wrote it, so `Exchange.SaveOptions` digests the whole bytes of its
  algorithm.
  
  `BrowserStreamHash.layer` reads SHA-256 with `@noble/hashes` in both forms, where
  it read the stream form with WebCrypto. A page therefore needs no secure context
  to read a digest, and no stream is held whole to be digested.

## 0.0.0-alpha.4

### Minor Changes

- [`db80c27`](https://github.com/trajs-ai/trajs/commit/db80c278550c477ea2491db89f67eb95829d971b) Thanks [@observerw](https://github.com/observerw)! - `Compression.compressBytes` and `Compression.decompressBytes` write and read one
  frame over the bytes of one region, which is what a writer that assembles a
  chunk of the stored container holds. `Compression.make` builds the service over
  a platform's stream codec and derives both from it, so every layer of a platform
  package answers the buffer form.
  
  `StreamHash.Hashing.digest` reads the digest as its 32 bytes rather than as 64
  hex characters, which is what a chunk is chained with. A running digest of the
  BLAKE3 of `@napi-rs/blake-hash` and of `blake3-wasm` reads it the same way, and
  `StreamHash.digest` still states the digest as hex, so a recorded digest is
  written as it was.

- [`6176cea`](https://github.com/trajs-ai/trajs/commit/6176cea7cf4130fcf85f75592e912d699bc22f19) Thanks [@observerw](https://github.com/observerw)! - `StreamHash` reads one of three digests: `Algorithm.Sha256` (0), `Algorithm.Blake2b512`
  (1) and `Algorithm.Xxh32` (2). `Algorithm.Blake3` and the 32-byte `Algorithm.Blake2b`
  are removed, and `StreamHash.defaultAlgorithm` is `Xxh32`, the cheapest of the three.
  
  A digest now has the bytes of its algorithm rather than 32 bytes for every one, so
  the metadata records 64 hex characters for SHA-256, 128 for BLAKE2b and 8 for XXH32.
  A trajectory that records BLAKE3 or the 32-byte BLAKE2b no longer decodes.
  
  `@trajs/platform-node` reads SHA-256 and BLAKE2b-512 with `node:crypto`, and XXH32
  with the binding `@node-rs/xxhash` in place of `@napi-rs/blake-hash`.
  `@trajs/platform-bun` reads SHA-256 and BLAKE2b-512 with `Bun.CryptoHasher`, and
  XXH32 with the JavaScript hash of `@trajs/utils`, so it no longer depends on
  `@trajs/platform-node`.
  `@trajs/platform-browser` reads BLAKE2b-512 and XXH32 with the JavaScript hash of
  `@trajs/utils`, so it no longer depends on `blake3-wasm`.

## 0.0.0-alpha.3

### Minor Changes

- [`8de6038`](https://github.com/trajs-ai/trajs/commit/8de60386eccdf99d6f78e5f1a4a050ea79213eba) Thanks [@observerw](https://github.com/observerw)! - A compression and a hash no longer state the algorithm they carry or digest with.
  `Compression.algorithm` and `StreamHash.algorithm` are removed. `Compression.compress`,
  `Compression.decompress` and `StreamHash.digest` take the algorithm as the option of
  the call (`Compression.Options`, `StreamHash.Options`). One service writes, reads and
  digests with every algorithm its platform states.
  `NodeCompression.layer`, `BunCompression.layer`, `BrowserCompression.layer`,
  `NodeStreamHash.layer`, `BrowserStreamHash.layer`, `StreamHash.layer` and
  `StreamHash.make` take no algorithm. `Options` is removed from `NodeServices`,
  `BunServices` and `BrowserServices`, and their `layer` is a constant layer.
  
  `Exchange.save` takes an `Exchange.SaveOptions`, the options of the compression and
  of the hash used for the write. It records both algorithms in the metadata it writes.
  `Exchange.load` reads a frame back in the algorithm of the metadata, not the
  algorithm of the compression. A trajectory written in gzip, deflate or no frame at
  all loads through a compression provided with no option.

## 0.0.0-alpha.2

No changes in this release.

## 0.0.0-alpha.1

### Patch Changes

- [`eb0faec`](https://github.com/trajs-ai/trajs/commit/eb0faec9944c344eabe9e32f19a7507b821e53ad) Thanks [@observerw](https://github.com/observerw)! - Release the core libraries under `packages/` as `0.0.0-alpha.1`. They are one
  Changesets `fixed` group and share that version: `@trajs/core`, `@trajs/olap`,
  `@trajs/platform-browser`, `@trajs/platform-bun`, `@trajs/platform-node` and
  `@trajs/utils`.
