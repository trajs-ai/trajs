---
"@trajs/backend-s3": minor
"@trajs/utils": minor
---

`ByteStore.layerS3` moves to the new `@trajs/backend-s3` as `S3ByteStore.layer`, so
the one place a bucket is reached from is a package of its own rather than the
package every platform shares.

`S3ByteStore.layer` sends its requests through the `S3Service` of
[`@effect-aws/client-s3`](https://github.com/floydspace/effect-aws), which types the failure S3
answers with, so a key that holds nothing is read as an id that holds nothing
rather than by the name the SDK reports it with. `S3ByteStore.Options` names the
bucket alone, and `@trajs/utils` no longer depends on `@aws-sdk/client-s3`.
