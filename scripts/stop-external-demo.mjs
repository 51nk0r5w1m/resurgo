import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const runtimeDirectory = resolve(root, ".secrets/demo-runtime");

async function stopProcess(pidName, expectedCommand) {
  const path = resolve(runtimeDirectory, pidName);
  let pid;
  try {
    pid = Number.parseInt((await readFile(path, "utf8")).trim(), 10);
  } catch {
    return;
  }
  if (!Number.isSafeInteger(pid) || pid < 2) {
    throw new Error(`Refusing invalid PID in ${path}`);
  }
  try {
    const command = (await readFile(`/proc/${pid}/cmdline`, "utf8")).replaceAll(
      "\0",
      " ",
    );
    if (!command.includes(expectedCommand)) {
      throw new Error(`Refusing to stop unexpected process ${pid}: ${command}`);
    }
    process.kill(-pid, "SIGTERM");
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )) {
      throw error;
    }
  } finally {
    await rm(path, { force: true });
  }
}

await stopProcess("tunnel.pid", "cloudflared");
await stopProcess("web.pid", "next");
const result = spawnSync("pnpm", ["infra:down"], {
  cwd: root,
  stdio: "inherit",
});
if (result.status !== 0)
  throw new Error("Private local infrastructure did not stop cleanly");
console.log(
  "External demo, tunnel, and private local services stopped. Data volumes were preserved.",
);
