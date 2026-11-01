import { describe, expect, test } from "vitest";

import { trustedAuthenticationOrigins } from "./auth-origins";

describe("trustedAuthenticationOrigins", () => {
  test("accepts both loopback spellings during local development", () => {
    expect(trustedAuthenticationOrigins("http://127.0.0.1:3000")).toEqual([
      "http://127.0.0.1:3000",
      "http://localhost:3000",
    ]);
  });

  test("does not broaden a production origin", () => {
    expect(trustedAuthenticationOrigins("https://demo.5o5.sh")).toEqual([
      "https://demo.5o5.sh",
    ]);
  });

  test("keeps both loopback spellings in a production-mode local demo", () => {
    expect(trustedAuthenticationOrigins("http://127.0.0.1:3000")).toEqual([
      "http://127.0.0.1:3000",
      "http://localhost:3000",
    ]);
  });
});
