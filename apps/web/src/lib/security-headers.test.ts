import { describe, expect, it } from "vitest";

import { securityHeaders } from "./security-headers";

describe("security headers", () => {
  it("denies embedding and executable object content", () => {
    const headers = new Map(
      securityHeaders.map(({ key, value }) => [key, value]),
    );
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers.get("Content-Security-Policy")).toContain(
      "object-src 'none'",
    );
  });

  it("does not advertise the framework", () => {
    expect(securityHeaders.map(({ key }) => String(key))).not.toContain(
      "X-Powered-By",
    );
  });
});
