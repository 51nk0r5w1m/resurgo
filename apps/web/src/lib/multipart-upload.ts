import Busboy from "@fastify/busboy";
import { Readable } from "node:stream";

export class MultipartUploadError extends Error {
  constructor(readonly kind: "invalid" | "too_large") {
    super(kind === "too_large" ? "Upload is too large" : "Invalid upload");
    this.name = "MultipartUploadError";
  }
}

export async function parseBoundedDocumentUpload(
  request: Request,
  maximumFileBytes: number,
) {
  const contentType = request.headers.get("content-type");
  if (!contentType || !request.body) throw new MultipartUploadError("invalid");

  return new Promise<{
    fields: Record<string, string>;
    file: { bytes: Uint8Array; mimeType: string };
  }>((resolve, reject) => {
    const fields: Record<string, string> = {};
    const chunks: Buffer[] = [];
    let fileMimeType: string | undefined;
    let fileSeen = false;
    let invalid = false;
    let tooLarge = false;
    let parser: ReturnType<typeof Busboy>;

    try {
      parser = Busboy({
        headers: { "content-type": contentType },
        limits: {
          fieldNameSize: 64,
          fieldSize: 512,
          fields: 3,
          fileSize: maximumFileBytes,
          files: 1,
          headerPairs: 20,
          headerSize: 8 * 1024,
          parts: 4,
        },
        preservePath: false,
      });
    } catch {
      reject(new MultipartUploadError("invalid"));
      return;
    }

    parser.on("field", (name, value, nameTruncated, valueTruncated) => {
      if (
        nameTruncated ||
        valueTruncated ||
        fields[name] !== undefined ||
        !["classification", "confidentiality", "title"].includes(name)
      ) {
        invalid = true;
        return;
      }
      fields[name] = value;
    });
    parser.on("file", (name, stream, _filename, _encoding, mimeType) => {
      if (name !== "file" || fileSeen) invalid = true;
      fileSeen = true;
      fileMimeType = mimeType;
      stream.on("limit", () => {
        tooLarge = true;
      });
      stream.on("data", (chunk: Buffer) => {
        chunks.push(Buffer.from(chunk));
      });
    });
    parser.on("fieldsLimit", () => {
      invalid = true;
    });
    parser.on("filesLimit", () => {
      invalid = true;
    });
    parser.on("partsLimit", () => {
      invalid = true;
    });
    parser.on("error", () => reject(new MultipartUploadError("invalid")));
    parser.on("finish", () => {
      if (tooLarge) {
        reject(new MultipartUploadError("too_large"));
      } else if (invalid || !fileSeen || !fileMimeType) {
        reject(new MultipartUploadError("invalid"));
      } else {
        resolve({
          fields,
          file: {
            bytes: new Uint8Array(Buffer.concat(chunks)),
            mimeType: fileMimeType,
          },
        });
      }
    });
    Readable.fromWeb(request.body as never)
      .on("error", () => {
        reject(new MultipartUploadError("invalid"));
      })
      .pipe(parser);
  });
}
