import { describe, expect, test } from "vitest";

import {
  MultipartUploadError,
  parseBoundedDocumentUpload,
} from "./multipart-upload";

function uploadRequest(bytes: Uint8Array) {
  const body = new FormData();
  body.set("classification", "financial");
  body.set("confidentiality", "financial_restricted");
  body.set("title", "Synthetic mortgage statement");
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  body.set(
    "file",
    new File([arrayBuffer], "synthetic.pdf", { type: "application/pdf" }),
  );
  return new Request("http://resurgo.test/upload", { body, method: "POST" });
}

describe("bounded multipart uploads", () => {
  test("returns allowlisted fields and streamed file bytes", async () => {
    const source = Buffer.from("%PDF-1.7\nsynthetic\n%%EOF");
    await expect(
      parseBoundedDocumentUpload(uploadRequest(source), 1024),
    ).resolves.toEqual({
      fields: {
        classification: "financial",
        confidentiality: "financial_restricted",
        title: "Synthetic mortgage statement",
      },
      file: {
        bytes: new Uint8Array(source),
        mimeType: "application/pdf",
      },
    });
  });

  test("fails closed when the streamed file exceeds its byte limit", async () => {
    await expect(
      parseBoundedDocumentUpload(uploadRequest(Buffer.alloc(32)), 8),
    ).rejects.toEqual(new MultipartUploadError("too_large"));
  });
});
