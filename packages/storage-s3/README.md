# @trajs/storage-s3

The `ByteStore` of [`@trajs/utils`](../utils) kept in a bucket of S3.

- `S3ByteStore` — the bytes a program keeps between readings, one object per id,
  read back a part at a time with a range request and kept as the sequence
  arrives. `layer` names the bucket and requires the `S3Service` of
  [`@effect-aws/client-s3`](https://npmjs.com/package/@effect-aws/client-s3), so
  the client, its region and its credentials are the program's to state:

  ```ts
  S3ByteStore.layer({ bucket: "trajs" }).pipe(Layer.provide(S3Service.defaultLayer));
  ```

  A write sends the sequence as the parts it fills, so at most one part is held
  in memory, and puts it as one object where it is shorter than a part. A write
  that ends before the sequence does leaves the id holding nothing, and drops
  the parts of the upload it opened.
