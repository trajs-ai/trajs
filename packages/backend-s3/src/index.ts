/**
 * The bytes a program keeps between readings in a bucket of S3.
 *
 * `S3ByteStore.layer` provides the `ByteStore` of `@trajs/utils` over a bucket, through the
 * `S3Service` of `@effect-aws/client-s3`, and is also a subpath import,
 * `@trajs/backend-s3/S3ByteStore`.
 *
 * @stability stable
 */

export * as S3ByteStore from "#/S3ByteStore.ts";
