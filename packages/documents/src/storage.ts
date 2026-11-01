import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

export interface PrivateObjectStorage {
  copy(sourceKey: string, destinationKey: string): Promise<void>;
  delete(key: string): Promise<void>;
  get(key: string, maximumBytes: number): Promise<Uint8Array>;
  head(key: string): Promise<{ byteSize: number; contentType?: string }>;
  put(input: {
    body: Uint8Array;
    contentHash: string;
    contentType: string;
    key: string;
  }): Promise<void>;
}

function assertPrivateKey(key: string) {
  if (
    !/^(available|previews|quarantine)\/[0-9a-f/-]+\/(source|preview\.pdf)$/u.test(
      key,
    ) ||
    key.includes("..")
  ) {
    throw new Error("Invalid private object key");
  }
}

async function boundedBytes(
  body: ReadableStream | Readable | Blob | undefined,
  maximumBytes: number,
) {
  if (!body) throw new Error("Object response did not contain a body");
  const stream =
    body instanceof Readable
      ? body
      : "transformToWebStream" in body
        ? Readable.fromWeb(
            (
              body as { transformToWebStream(): ReadableStream }
            ).transformToWebStream() as never,
          )
        : Readable.fromWeb((body as Blob).stream() as never);
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as ArrayBuffer);
    total += bytes.length;
    if (total > maximumBytes)
      throw new Error("Stored object exceeds byte limit");
    chunks.push(bytes);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

export function createS3PrivateObjectStorage(input: {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  region: string;
  secretAccessKey: string;
}): PrivateObjectStorage {
  const client = new S3Client({
    endpoint: input.endpoint,
    forcePathStyle: true,
    region: input.region,
    credentials: {
      accessKeyId: input.accessKeyId,
      secretAccessKey: input.secretAccessKey,
    },
  });
  return {
    async copy(sourceKey, destinationKey) {
      assertPrivateKey(sourceKey);
      assertPrivateKey(destinationKey);
      await client.send(
        new CopyObjectCommand({
          Bucket: input.bucket,
          CopySource: `${input.bucket}/${sourceKey}`,
          Key: destinationKey,
          MetadataDirective: "COPY",
        }),
      );
    },
    async delete(key) {
      assertPrivateKey(key);
      await client.send(
        new DeleteObjectCommand({ Bucket: input.bucket, Key: key }),
      );
    },
    async get(key, maximumBytes) {
      assertPrivateKey(key);
      const response = await client.send(
        new GetObjectCommand({ Bucket: input.bucket, Key: key }),
      );
      return boundedBytes(response.Body, maximumBytes);
    },
    async head(key) {
      assertPrivateKey(key);
      const response = await client.send(
        new HeadObjectCommand({ Bucket: input.bucket, Key: key }),
      );
      if (response.ContentLength === undefined) {
        throw new Error("Stored object has no content length");
      }
      return {
        byteSize: response.ContentLength,
        ...(response.ContentType ? { contentType: response.ContentType } : {}),
      };
    },
    async put({ body, contentHash, contentType, key }) {
      assertPrivateKey(key);
      await client.send(
        new PutObjectCommand({
          Body: body,
          Bucket: input.bucket,
          ContentLength: body.byteLength,
          ContentType: contentType,
          Key: key,
          Metadata: { "content-sha256": contentHash },
          ServerSideEncryption: "AES256",
        }),
      );
    },
  };
}
