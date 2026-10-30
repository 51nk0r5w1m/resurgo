import { describe, expect, it } from "vitest";

import { classifyAuthenticationResponse } from "./auth-audit";

describe("authentication response audit classification", () => {
  it("does not classify a successful HTTP response with an auth error as success", async () => {
    await expect(
      classifyAuthenticationResponse(
        Response.json({ code: "INVALID_EMAIL_OR_PASSWORD" }),
      ),
    ).resolves.toEqual({
      outcome: "denied",
      reasonCode: "auth_response_error",
    });
  });

  it("classifies successful and rejected responses without exposing payloads", async () => {
    await expect(
      classifyAuthenticationResponse(Response.json({ user: { id: "opaque" } })),
    ).resolves.toEqual({ outcome: "success" });
    await expect(
      classifyAuthenticationResponse(new Response(null, { status: 401 })),
    ).resolves.toEqual({ outcome: "denied", reasonCode: "http_401" });
  });
});
