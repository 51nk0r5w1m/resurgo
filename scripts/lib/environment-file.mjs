import { readFile } from "node:fs/promises";

export function parseEnvironmentFile(contents) {
  const entries = [];

  for (const [index, rawLine] of contents.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    const key = separator > 0 ? line.slice(0, separator).trim() : "";
    if (separator < 1 || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      throw new Error(
        `Invalid environment file syntax at line ${index + 1}; expected KEY=VALUE`,
      );
    }

    entries.push([key, line.slice(separator + 1)]);
  }

  return Object.fromEntries(entries);
}

export async function readOptionalEnvironmentFile(path) {
  try {
    return parseEnvironmentFile(await readFile(path, "utf8"));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }
    throw error;
  }
}
