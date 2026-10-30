import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, unlink } from "node:fs/promises";

function isAlreadyPresent(error) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

async function assertExistingPathIsSafe(path) {
  const stats = await lstat(path);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`Refusing unsafe existing secret path: ${path}`);
  }
}

export async function ensurePrivateDirectory(path) {
  await mkdir(path, { mode: 0o700, recursive: true });

  const directory = await open(
    path,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    const stats = await directory.stat();
    if (!stats.isDirectory()) {
      throw new Error(`Secret path is not a directory: ${path}`);
    }
    await directory.chmod(0o700);
  } finally {
    await directory.close();
  }
}

export async function writeExclusive(path, contents) {
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  let temporaryFile;

  try {
    temporaryFile = await open(
      temporaryPath,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    await temporaryFile.writeFile(contents);
    await temporaryFile.sync();
    await temporaryFile.close();
    temporaryFile = undefined;

    try {
      await link(temporaryPath, path);
      return true;
    } catch (error) {
      if (!isAlreadyPresent(error)) throw error;
      await assertExistingPathIsSafe(path);
      return false;
    }
  } finally {
    await temporaryFile?.close().catch(() => undefined);
    await unlink(temporaryPath).catch((error) => {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    });
  }
}
