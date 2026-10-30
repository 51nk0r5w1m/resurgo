import { resolve } from "node:path";

import {
  formatEnvironmentError,
  parseEnvironment,
} from "../packages/config/src/environment.ts";
import { readOptionalEnvironmentFile } from "./lib/environment-file.mjs";

const envPath = process.env.RESURGO_ENV_FILE
  ? resolve(process.env.RESURGO_ENV_FILE)
  : resolve(import.meta.dirname, "../.env");

try {
  const fileEnvironment = await readOptionalEnvironmentFile(envPath);
  parseEnvironment({ ...fileEnvironment, ...process.env });
  console.log("Environment configuration is valid.");
} catch (error) {
  if (error && typeof error === "object" && "issues" in error) {
    console.error(formatEnvironmentError(error));
    process.exitCode = 1;
  } else {
    throw error;
  }
}
