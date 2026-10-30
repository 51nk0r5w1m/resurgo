import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  formatEnvironmentError,
  parseEnvironment,
} from "../packages/config/src/environment.ts";

const envPath = resolve(import.meta.dirname, "../.env");
const envText = await readFile(envPath, "utf8");
const input = Object.fromEntries(
  envText
    .split(/\r?\n/u)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

try {
  parseEnvironment({ ...process.env, ...input });
  console.log("Environment configuration is valid.");
} catch (error) {
  if (error && typeof error === "object" && "issues" in error) {
    console.error(formatEnvironmentError(error));
    process.exitCode = 1;
  } else {
    throw error;
  }
}
