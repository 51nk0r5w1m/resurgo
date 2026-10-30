import {
  mkdtemp,
  readFile,
  readdir,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { ensurePrivateDirectory, writeExclusive } from "./secure-files.mjs";

describe("secure local file initialization", () => {
  test("publishes complete files and preserves existing contents", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resurgo-secrets-"));
    await ensurePrivateDirectory(directory);
    const path = join(directory, "secret");

    await expect(writeExclusive(path, "first\n")).resolves.toBe(true);
    await expect(writeExclusive(path, "replacement\n")).resolves.toBe(false);
    await expect(readFile(path, "utf8")).resolves.toBe("first\n");
  });

  test("rejects an existing symlink instead of following or overwriting it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resurgo-secrets-"));
    const target = join(directory, "target");
    const path = join(directory, "secret");
    await writeFile(target, "preserved\n", { mode: 0o600 });
    await symlink(target, path);

    await expect(writeExclusive(path, "replacement\n")).rejects.toThrow(
      "Refusing unsafe existing secret path",
    );
    await expect(readFile(target, "utf8")).resolves.toBe("preserved\n");
  });

  test("removes a temporary file when writing fails before publication", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resurgo-secrets-"));
    const path = join(directory, "secret");

    await expect(
      writeExclusive(path, Symbol("invalid contents")),
    ).rejects.toThrow();
    await expect(readdir(directory)).resolves.toEqual([]);
  });

  test("rejects a symlink in place of the secrets directory", async () => {
    const parent = await mkdtemp(join(tmpdir(), "resurgo-secrets-"));
    const target = join(parent, "target");
    const path = join(parent, "secrets");
    await ensurePrivateDirectory(target);
    await symlink(target, path);

    await expect(ensurePrivateDirectory(path)).rejects.toThrow();
  });
});
