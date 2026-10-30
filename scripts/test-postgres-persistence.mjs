import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const compose = await readFile(
  resolve(root, "infra/compose/compose.yaml"),
  "utf8",
);
const image = compose.match(/^    image: (postgres:[^\n]+)$/mu)?.[1];
const volumeTarget = compose.match(
  /^      - postgres-data:(\/var\/lib\/postgresql(?:\/[^\n]+)?)$/mu,
)?.[1];

if (!image || volumeTarget !== "/var/lib/postgresql/18/docker") {
  throw new Error(
    "Compose must preserve the established PostgreSQL 18 PGDATA mount path",
  );
}

const suffix = randomUUID().replaceAll("-", "");
const volume = `resurgo-pg-persistence-${suffix}`;
const container = `resurgo-pg-persistence-${suffix}`;
const password = `synthetic-${suffix}`;

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

function requireSuccess(result, action) {
  if (result.status !== 0) {
    throw new Error(`${action} failed: ${result.stderr.trim()}`);
  }
}

function startContainer() {
  requireSuccess(
    docker([
      "run",
      "--detach",
      "--name",
      container,
      "--env",
      "POSTGRES_DB=resurgo_persistence",
      "--env",
      `POSTGRES_PASSWORD=${password}`,
      "--env",
      "POSTGRES_USER=resurgo_persistence",
      "--volume",
      `${volume}:${volumeTarget}`,
      image,
    ]),
    "PostgreSQL container start",
  );

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ready = docker([
      "exec",
      container,
      "psql",
      "--no-psqlrc",
      "--tuples-only",
      "--no-align",
      "-U",
      "resurgo_persistence",
      "-d",
      "resurgo_persistence",
      "-c",
      "select 1",
    ]);
    if (ready.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error("PostgreSQL persistence test container did not become ready");
}

function sql(statement) {
  const result = docker([
    "exec",
    container,
    "psql",
    "--no-psqlrc",
    "--tuples-only",
    "--no-align",
    "-U",
    "resurgo_persistence",
    "-d",
    "resurgo_persistence",
    "-c",
    statement,
  ]);
  requireSuccess(result, "PostgreSQL persistence query");
  return result.stdout.trim();
}

try {
  requireSuccess(docker(["volume", "create", volume]), "Volume creation");
  startContainer();
  sql("create table persistence_canary (value text primary key)");
  sql("insert into persistence_canary values ('synthetic-survives-recreate')");
  requireSuccess(docker(["rm", "--force", container]), "Container removal");

  startContainer();
  const persisted = sql("select value from persistence_canary");
  if (persisted !== "synthetic-survives-recreate") {
    throw new Error("PostgreSQL named-volume data did not survive recreation");
  }
  console.log("PostgreSQL data survived container removal and recreation.");
} finally {
  docker(["rm", "--force", container]);
  docker(["volume", "rm", "--force", volume]);
}
