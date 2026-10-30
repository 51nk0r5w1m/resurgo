import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const image =
  "zricethezav/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
const repository = await mkdtemp(join(tmpdir(), "resurgo-gitleaks-canary-"));

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repository,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return result;
}

try {
  for (const args of [
    ["init", "--quiet"],
    ["config", "user.email", "synthetic-security-test@resurgo.invalid"],
    ["config", "user.name", "Resurgo synthetic security test"],
  ]) {
    const result = run("git", args);
    if (result.status !== 0)
      throw new Error("Could not create canary repository");
  }

  const syntheticToken = [
    "ghp",
    "_",
    randomBytes(27).toString("base64url").slice(0, 36),
  ].join("");
  await writeFile(
    join(repository, "synthetic-canary.txt"),
    `SYNTHETIC_GITHUB_TOKEN=${syntheticToken}\n`,
    { mode: 0o600 },
  );
  for (const args of [
    ["add", "synthetic-canary.txt"],
    ["commit", "--quiet", "-m", "synthetic secret detection canary"],
  ]) {
    const result = run("git", args);
    if (result.status !== 0) throw new Error("Could not commit canary secret");
  }

  const scan = run("docker", [
    "run",
    "--rm",
    "--network",
    "none",
    "--volume",
    `${repository}:/repo:ro`,
    "--workdir",
    "/repo",
    "--entrypoint",
    "/usr/bin/gitleaks",
    image,
    "git",
    "--no-banner",
    "--redact",
  ]);

  if (scan.status !== 1 || !scan.stderr.includes("leaks found")) {
    throw new Error(
      `Gitleaks canary was not detected as expected (status ${scan.status})`,
    );
  }
  if (`${scan.stdout}${scan.stderr}`.includes(syntheticToken)) {
    throw new Error("Gitleaks canary output exposed the synthetic secret");
  }

  console.log("Gitleaks detected and redacted the synthetic secret canary.");
} finally {
  await rm(repository, { force: true, recursive: true });
}
