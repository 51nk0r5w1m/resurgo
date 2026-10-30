import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, test } from "vitest";

describe("environment validation command", () => {
  test("validates exported process variables when the optional file is absent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resurgo-env-command-"));
    const result = spawnSync(
      process.execPath,
      [resolve(import.meta.dirname, "check-env.mjs")],
      {
        encoding: "utf8",
        env: {
          BETTER_AUTH_SECRET:
            "synthetic-better-auth-secret-with-more-than-32-characters",
          DATABASE_URL:
            "postgresql://resurgo:synthetic-password@127.0.0.1:5432/resurgo",
          GARAGE_ACCESS_KEY_ID: "GK0123456789ABCDEF0123456789ABCDEF",
          GARAGE_BUCKET: "resurgo-synthetic-private",
          GARAGE_ENDPOINT: "http://127.0.0.1:3900",
          GARAGE_REGION: "garage",
          GARAGE_SECRET_ACCESS_KEY:
            "synthetic-garage-secret-with-more-than-24-characters",
          NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
          NODE_ENV: "test",
          PATH: process.env.PATH,
          POSTGRES_DB: "resurgo",
          POSTGRES_PASSWORD:
            "synthetic-postgres-password-with-more-than-24-characters",
          POSTGRES_USER: "resurgo",
          RESURGO_ENV_FILE: join(directory, "absent.env"),
          SMTP_FROM: "no-reply@resurgo.test",
          SMTP_HOST: "127.0.0.1",
          SMTP_PORT: "1025",
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Environment configuration is valid.");
    expect(result.stderr).toBe("");
  });
});
