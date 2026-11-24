# @trajs/storage-s3

## 0.0.0-alpha.5

### Minor Changes

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

### Patch Changes

- Updated dependencies [[`047e37d`](https://github.com/trajs-ai/trajs/commit/047e37d162f322a9a667fe013e558ca80d49f25e), [`aceb66b`](https://github.com/trajs-ai/trajs/commit/aceb66b85a53239da3414204bc234ff86d8bf4b5), [`9ffc4ce`](https://github.com/trajs-ai/trajs/commit/9ffc4cef2e0498e75b54cbc421dc65eb6ffd3925), [`35853e6`](https://github.com/trajs-ai/trajs/commit/35853e654ce7d96682046b5c7d1eda17e9f3e53e), [`3a2f353`](https://github.com/trajs-ai/trajs/commit/3a2f353873e7133888131d5a88768ba5d131324a), [`c396840`](https://github.com/trajs-ai/trajs/commit/c396840173c01f77317b7f985a6c87fda93d5194), [`a566ead`](https://github.com/trajs-ai/trajs/commit/a566ead936a0f90e2f0aa4ab2e3975ab1d344191), [`8537a14`](https://github.com/trajs-ai/trajs/commit/8537a14ad680e1a885de070aea5be2b5e90bd2b2), [`ab96c7e`](https://github.com/trajs-ai/trajs/commit/ab96c7e8f920c66b5fa0d10d223a529bf2f51150), [`8537a14`](https://github.com/trajs-ai/trajs/commit/8537a14ad680e1a885de070aea5be2b5e90bd2b2)]:
  - @trajs/utils@0.0.0-alpha.5
