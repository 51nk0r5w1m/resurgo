import { describe, expect, it } from "vitest";

import {
  formatEnvironmentError,
  parseDocumentWorkerEnvironment,
  parseEnvironment,
} from "./environment";

const validEnvironment = {
  BETTER_AUTH_SECRET:
    "synthetic-better-auth-secret-with-more-than-32-characters",
  DATABASE_URL:
    "postgresql://resurgo:synthetic-password@127.0.0.1:5432/resurgo",
  GARAGE_ACCESS_KEY_ID: "GK0123456789ABCDEF0123456789ABCDEF",
  GARAGE_BUCKET: "resurgo-quarantine",
  GARAGE_ENDPOINT: "http://127.0.0.1:3900",
  GARAGE_REGION: "garage",
  GARAGE_SECRET_ACCESS_KEY: "synthetic-secret-with-more-than-24-characters",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  NODE_ENV: "test",
  POSTGRES_DB: "resurgo",
  POSTGRES_PASSWORD: "synthetic-password-with-32-characters",
  POSTGRES_USER: "resurgo",
  SMTP_FROM: "no-reply@resurgo.test",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
} satisfies NodeJS.ProcessEnv;

describe("environment validation", () => {
  it("accepts a complete synthetic local configuration", () => {
    expect(parseEnvironment(validEnvironment).POSTGRES_DB).toBe("resurgo");
  });

  it("starts the document worker without authentication or mail secrets", () => {
    const workerEnvironment = {
      DATABASE_URL: validEnvironment.DATABASE_URL,
      GARAGE_ACCESS_KEY_ID: validEnvironment.GARAGE_ACCESS_KEY_ID,
      GARAGE_BUCKET: validEnvironment.GARAGE_BUCKET,
      GARAGE_ENDPOINT: validEnvironment.GARAGE_ENDPOINT,
      GARAGE_REGION: validEnvironment.GARAGE_REGION,
      GARAGE_SECRET_ACCESS_KEY: validEnvironment.GARAGE_SECRET_ACCESS_KEY,
      NODE_ENV: validEnvironment.NODE_ENV,
    };

    expect(parseDocumentWorkerEnvironment(workerEnvironment).DATABASE_URL).toBe(
      validEnvironment.DATABASE_URL,
    );
  });

  it("rejects placeholder secrets without echoing their values", () => {
    try {
      parseEnvironment({ ...validEnvironment, POSTGRES_PASSWORD: "change-me" });
      throw new Error("Expected environment validation to fail");
    } catch (error) {
      expect(formatEnvironmentError(error as never)).toBe(
        "Invalid environment configuration: POSTGRES_PASSWORD",
      );
      expect(formatEnvironmentError(error as never)).not.toContain("change-me");
    }
  });
});
