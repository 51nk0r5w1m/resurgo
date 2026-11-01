import { describe, expect, test } from "vitest";

import {
  blocksExternalDemoRegistration,
  isExternalDemoMode,
} from "./demo-mode";

describe("external demonstration mode", () => {
  test("blocks registration only in the access-controlled external demo", () => {
    expect(isExternalDemoMode({ RESURGO_DEMO_EXTERNAL: "true" })).toBe(true);
    expect(
      blocksExternalDemoRegistration("/api/auth/sign-up/email", {
        RESURGO_DEMO_EXTERNAL: "true",
      }),
    ).toBe(true);
    expect(
      blocksExternalDemoRegistration("/api/auth/sign-in/email", {
        RESURGO_DEMO_EXTERNAL: "true",
      }),
    ).toBe(false);
    expect(blocksExternalDemoRegistration("/api/auth/sign-up/email", {})).toBe(
      false,
    );
  });
});
