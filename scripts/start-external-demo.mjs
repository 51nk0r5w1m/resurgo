import {
  closeSync,
  constants,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { parseEnvironmentFile } from "./lib/environment-file.mjs";

const root = resolve(import.meta.dirname, "..");
const secretsDirectory = resolve(root, ".secrets");
const runtimeDirectory = resolve(secretsDirectory, "demo-runtime");
const environmentPath = resolve(secretsDirectory, "demo-external.env");
const tokenPath = resolve(secretsDirectory, "cloudflared-token");
const cloudflaredPath = resolve(root, ".tools/cloudflared");
const publicOrigin = "https://demo.5o5.sh";

function requirePrivateFile(path, label) {
  const details = statSync(path);
  if ((details.mode & 0o077) !== 0) {
    throw new Error(`${label} must have mode 0600: ${path}`);
  }
  if (details.size === 0) throw new Error(`${label} is empty: ${path}`);
}

function run(command, args, environment) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: environment,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function pidIsRunning(path) {
  try {
    const pid = Number.parseInt(readFileSync(path, "utf8"), 10);
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function startDetached(command, args, environment, logName, pidName) {
  const logPath = resolve(runtimeDirectory, logName);
  const output = openSync(logPath, "a", 0o600);
  const child = spawn(command, args, {
    cwd: root,
    detached: true,
    env: environment,
    stdio: ["ignore", output, output],
  });
  closeSync(output);
  if (!child.pid) throw new Error(`Could not start ${command}`);
  writeFileSync(resolve(runtimeDirectory, pidName), `${child.pid}\n`, {
    mode: 0o600,
  });
  child.unref();
  return child.pid;
}

async function waitForLocalApp() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:3000/login", {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  }
  throw new Error("Resurgo did not become healthy on 127.0.0.1:3000");
}

await access(environmentPath, constants.R_OK);
await access(tokenPath, constants.R_OK);
await access(cloudflaredPath, constants.X_OK);
requirePrivateFile(environmentPath, "External demo environment");
requirePrivateFile(tokenPath, "Cloudflare connector token");
mkdirSync(runtimeDirectory, { mode: 0o700, recursive: true });

for (const pidName of ["web.pid", "tunnel.pid"]) {
  const path = resolve(runtimeDirectory, pidName);
  if (pidIsRunning(path)) {
    throw new Error(
      "The external demo is already running. Use pnpm demo:external:stop first.",
    );
  }
}

try {
  const response = await fetch("http://127.0.0.1:3000", {
    signal: AbortSignal.timeout(1_000),
  });
  if (response.ok) {
    throw new Error(
      "Port 3000 is already serving an application. Stop it before starting the external demo.",
    );
  }
} catch (error) {
  if (error instanceof Error && error.message.startsWith("Port 3000")) {
    throw error;
  }
}

const baseEnvironment = parseEnvironmentFile(
  await readFile(resolve(root, ".env"), "utf8"),
);
const externalEnvironment = parseEnvironmentFile(
  await readFile(environmentPath, "utf8"),
);
const environment = {
  ...process.env,
  ...baseEnvironment,
  ...externalEnvironment,
  NODE_ENV: "production",
};
if (environment.NEXT_PUBLIC_APP_URL !== publicOrigin) {
  throw new Error(`NEXT_PUBLIC_APP_URL must equal ${publicOrigin}`);
}
if (
  !environment.BETTER_AUTH_SECRET ||
  environment.BETTER_AUTH_SECRET.length < 32
) {
  throw new Error("The external demo Better Auth secret is invalid");
}

run("pnpm", ["infra:up"], environment);
run("pnpm", ["db:migrate"], environment);
run("pnpm", ["build"], environment);

const webPid = startDetached(
  "pnpm",
  [
    "--filter",
    "@resurgo/web",
    "exec",
    "next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  environment,
  "web.log",
  "web.pid",
);
try {
  await waitForLocalApp();
} catch (error) {
  process.kill(-webPid, "SIGTERM");
  throw error;
}

const tunnelPid = startDetached(
  cloudflaredPath,
  [
    "tunnel",
    "--no-autoupdate",
    "--metrics",
    "127.0.0.1:20241",
    "--loglevel",
    "info",
    "run",
    "--token-file",
    tokenPath,
  ],
  environment,
  "cloudflared.log",
  "tunnel.pid",
);
await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
try {
  process.kill(tunnelPid, 0);
} catch {
  process.kill(-webPid, "SIGTERM");
  throw new Error(
    `cloudflared exited during startup; inspect ${resolve(runtimeDirectory, "cloudflared.log")}`,
  );
}

console.log(`Local origin ready: http://127.0.0.1:3000`);
console.log(`Tunnel connector started for: ${publicOrigin}`);
console.log(
  "External access is not verified until Cloudflare Access and browser checks pass.",
);
