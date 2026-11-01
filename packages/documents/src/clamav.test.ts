import { describe, expect, test } from "vitest";

import { scanWithClamAv } from "./clamav";

describe("ClamAV destination boundary", () => {
  test("rejects arbitrary hosts before opening a scanner connection", async () => {
    await expect(
      scanWithClamAv(new Uint8Array(), {
        host: "169.254.169.254",
        port: 3310,
      }),
    ).rejects.toThrow("Malware scanner destination is not allowed");
    await expect(
      scanWithClamAv(new Uint8Array(), {
        host: "internal-service.example",
        port: 3310,
      }),
    ).rejects.toThrow("Malware scanner destination is not allowed");
  });

  test("rejects non-ClamAV ports even on an allowed host", async () => {
    await expect(
      scanWithClamAv(new Uint8Array(), {
        host: "127.0.0.1",
        port: 5432,
      }),
    ).rejects.toThrow("Malware scanner destination is not allowed");
  });
});
