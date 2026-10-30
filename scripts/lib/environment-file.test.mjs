import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  parseEnvironmentFile,
  readOptionalEnvironmentFile,
} from "./environment-file.mjs";

describe("environment file parsing", () => {
  test("parses values containing equals signs", () => {
    expect(parseEnvironmentFile("KEY=value=with=equals\n")).toEqual({
      KEY: "value=with=equals",
    });
  });

  test("rejects malformed non-comment lines without exposing their value", () => {
    expect(() => parseEnvironmentFile("MALFORMED_SECRET_LINE\n")).toThrow(
      "Invalid environment file syntax at line 1; expected KEY=VALUE",
    );
  });

  test("returns an empty overlay when the optional file is absent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resurgo-env-"));
    await expect(
      readOptionalEnvironmentFile(join(directory, "missing.env")),
    ).resolves.toEqual({});
  });
});
