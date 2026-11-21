/**
 * The store read against a bucket held in memory: the object an id is kept as, and the
 * requests a read, a write and a removal send.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { S3Service } from "@effect-aws/client-s3";
import * as ByteStore from "@trajs/utils/ByteStore";
import { Effect, Layer, Option, Stream } from "effect";
import { describe, expect, it } from "vite-plus/test";

import * as S3ByteStore from "#/S3ByteStore.ts";

/** The objects a bucket holds, and the requests sent to it. */
interface Bucket {
  readonly objects: Map<string, Uint8Array>;
  readonly requests: Array<string>;
}

type Sent = HeadObjectCommand | GetObjectCommand | PutObjectCommand | DeleteObjectCommand;

/** What a bucket answers a command with, as far as one states it. */
interface Answer {
  readonly ContentLength?: number;
  readonly Body?: { readonly transformToByteArray: () => Promise<Uint8Array> };
  readonly $metadata: { readonly httpStatusCode?: number };
}

/** The failure S3 answers a request with. */
const refuse = (name: string, httpStatusCode: number) =>
  new S3ServiceException({
    name,
    message: name,
    $fault: "client",
    $metadata: { httpStatusCode },
  });

/** The bytes the range of a request asks for, as the two ends it states. */
const rangeOf = (stated: string): readonly [number, number] => {
  const [start, end] = stated.replace("bytes=", "").split("-");

  return [Number(start), Number(end)];
};

/** An S3 client that serves `bucket` in place of a service. */
const clientOf = (bucket: Bucket): S3Client => {
  const send = async (command: Sent): Promise<Answer> => {
    const key = command.input.Key ?? "";

    if (command instanceof HeadObjectCommand) {
      bucket.requests.push(`HEAD ${key}`);

      const held = bucket.objects.get(key);

      if (held === undefined) throw refuse("NotFound", 404);

      return { ContentLength: held.length, $metadata: {} };
    }

    if (command instanceof GetObjectCommand) {
      bucket.requests.push(`GET ${key} ${command.input.Range}`);

      const held = bucket.objects.get(key);

      if (held === undefined) throw refuse("NoSuchKey", 404);

      const [start, end] = rangeOf(command.input.Range ?? "bytes=0-0");

      // A range that begins at or past the end of the object is out of range, as a bucket
      // answers one.
      if (start >= held.length) throw refuse("InvalidRange", 416);

      const taken = held.slice(start, Math.min(end + 1, held.length));

      return { Body: { transformToByteArray: async () => taken }, $metadata: {} };
    }

    if (command instanceof PutObjectCommand) {
      bucket.requests.push(`PUT ${key}`);

      const buffered = command.input.Body;

      if (!(buffered instanceof Uint8Array)) throw new Error("The body of a put is not bytes");

      bucket.objects.set(key, buffered);

      return { $metadata: {} };
    }

    if (command instanceof DeleteObjectCommand) {
      bucket.requests.push(`DELETE ${key}`);

      bucket.objects.delete(key);

      return { $metadata: {} };
    }

    throw new Error(`The store sent a command a bucket states no answer to`);
  };

  // SAFETY: the store sends the four commands above, and reads nothing else of the client, which
  // is what `S3Client` adds to the one `send` this states.
  return { send } as S3Client;
};

/** The bucket a run keeps its sequences in, as the layer over it. */
const bucketOf = (bucket: Bucket): Layer.Layer<ByteStore.ByteStore> =>
  S3ByteStore.layer({ bucket: "trajs" }).pipe(
    Layer.provide(S3Service.baseLayer(() => clientOf(bucket))),
  );

/** An empty bucket, with the requests it is sent. */
const empty = (): Bucket => ({ objects: new Map(), requests: [] });

const text = (held: Uint8Array): string => new TextDecoder().decode(held);

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("layer", () => {
  it("keeps a sequence as one object, read back as the part it asks for", async () => {
    const bucket = empty();

    const run = Effect.gen(function* () {
      const store = yield* ByteStore.ByteStore;

      yield* Stream.make(bytes("trajs")).pipe(Stream.run(store.write("parts/0")));

      const held = yield* store.read("parts/0");

      const tail = yield* held.readAlloc({ offset: 2n });

      return {
        tail: text(Option.getOrThrow(tail)),
        length: yield* held.length,
        kept: text(bucket.objects.get("parts/0")!),
      };
    });

    const outcome = await run.pipe(Effect.provide(bucketOf(bucket)), Effect.runPromise);

    expect(outcome).toEqual({ tail: "ajs", length: 5n, kept: "trajs" });
    // A read asks the part of the sequence it came for rather than the whole object.
    expect(bucket.requests).toContain("GET parts/0 bytes=2-4");
  });

  it("reads an id that holds nothing as a failure", async () => {
    const layer = bucketOf(empty());

    const run = Effect.gen(function* () {
      const store = yield* ByteStore.ByteStore;

      return {
        has: yield* store.has("absent"),
        read: yield* store.read("absent").pipe(Effect.flip),
      };
    });

    const outcome = await run.pipe(Effect.provide(layer), Effect.runPromise);

    expect(outcome.has).toBe(false);

    expect(outcome.has).toBe(false);
    expect(outcome.read).toBeInstanceOf(ByteStore.ByteStoreError);
  });

  it("serves no bytes where a read begins past the end of a sequence", async () => {
    const bucket = empty();

    const run = Effect.gen(function* () {
      const store = yield* ByteStore.ByteStore;

      yield* Stream.make(bytes("trajs")).pipe(Stream.run(store.write("parts/0")));

      const held = yield* store.read("parts/0");

      return yield* held.read(new Uint8Array(8), { offset: 5n, size: 8 });
    });

    const read = await run.pipe(Effect.provide(bucketOf(bucket)), Effect.runPromise);

    expect(read).toBe(0);
    expect(bucket.requests).toContain("GET parts/0 bytes=5-12");
  });

  it("keeps nothing under an id a write ends before the sequence does", async () => {
    const bucket = empty();

    const run = Effect.gen(function* () {
      const store = yield* ByteStore.ByteStore;

      yield* Stream.make(bytes("kept")).pipe(Stream.run(store.write("parts/0")));

      yield* Stream.fail("A source that ended early").pipe(
        Stream.run(store.write("parts/0")),
        Effect.catch(() => Effect.void),
      );

      return yield* store.has("parts/0");
    });

    const has = await run.pipe(Effect.provide(bucketOf(bucket)), Effect.runPromise);

    expect(has).toBe(false);
  });

  it("writes over an id unless the write says not to, and drops what it held on remove", async () => {
    const bucket = empty();

    const run = Effect.gen(function* () {
      const store = yield* ByteStore.ByteStore;

      yield* Stream.make(bytes("first")).pipe(Stream.run(store.write("parts/0")));

      const refused = yield* Stream.make(bytes("second")).pipe(
        Stream.run(store.write("parts/0", { overwrite: false })),
        Effect.flip,
      );

      yield* Stream.make(bytes("second")).pipe(Stream.run(store.write("parts/0")));

      const kept = text(bucket.objects.get("parts/0")!);

      yield* store.remove("parts/0");

      return { refused, kept, has: yield* store.has("parts/0") };
    });

    const outcome = await run.pipe(Effect.provide(bucketOf(bucket)), Effect.runPromise);

    expect(outcome.refused).toBeInstanceOf(ByteStore.ByteStoreError);
    expect(outcome).toMatchObject({ kept: "second", has: false });
  });
});
