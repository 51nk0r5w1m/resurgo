import { describe, expect, test } from "vitest";

import { scanWithClamAv } from "./clamav";

const scanner = {
  host: process.env.CLAMAV_HOST ?? "127.0.0.1",
  port: Number(process.env.CLAMAV_PORT ?? "3310"),
  timeoutMilliseconds: 10_000,
};

describe("ClamAV streaming integration", () => {
  test("accepts harmless synthetic content", async () => {
    await expect(
      scanWithClamAv(
        Buffer.from("Synthetic Resurgo document fixture without client data."),
        scanner,
      ),
    ).resolves.toEqual({ clean: true });
  });

  test("rejects the standard antivirus test signature", async () => {
    const signature = [
      "X5O!P%@AP[4\\PZX54(P^)",
      "7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    ].join("");

    await expect(
      scanWithClamAv(Buffer.from(signature), scanner),
    ).rejects.toThrow("Malware scanner rejected the document");
  });
});
