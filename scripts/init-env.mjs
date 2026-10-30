import { randomBytes } from "node:crypto";
import { chmod, mkdir, open, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");
const secretsDirectory = resolve(root, ".secrets");

function randomHex(bytes) {
  return randomBytes(bytes).toString("hex");
}

async function writeExclusive(path, contents) {
  try {
    const file = await open(path, "wx", 0o600);
    await file.writeFile(contents);
    await file.close();
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      return false;
    }
    throw error;
  }
}

await mkdir(secretsDirectory, { mode: 0o700, recursive: true });
await chmod(secretsDirectory, 0o700);

const postgresPassword = randomHex(24);
const garageAccessKey = `GK${randomHex(16).toUpperCase()}`;
const garageSecretKey = randomHex(32);
const envContents = `NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000

POSTGRES_USER=resurgo
POSTGRES_PASSWORD=${postgresPassword}
POSTGRES_DB=resurgo
POSTGRES_PORT=5432
DATABASE_URL=postgresql://resurgo:${postgresPassword}@127.0.0.1:5432/resurgo

GARAGE_ENDPOINT=http://127.0.0.1:3900
GARAGE_PORT=3900
GARAGE_REGION=garage
GARAGE_BUCKET=resurgo-local-private
GARAGE_ACCESS_KEY_ID=${garageAccessKey}
GARAGE_SECRET_ACCESS_KEY=${garageSecretKey}
`;

const envCreated = await writeExclusive(envPath, envContents);
const secretFiles = [
  ["garage_rpc_secret", randomHex(32)],
  ["garage_admin_token", randomHex(32)],
  ["garage_metrics_token", randomHex(32)],
];

for (const [name, secret] of secretFiles) {
  const path = resolve(secretsDirectory, name);
  if (await writeExclusive(path, `${secret}\n`)) {
    await chmod(path, 0o600);
  }
}

if (envCreated) {
  await chmod(envPath, 0o600);
  console.log("Created local .env and Garage secret files.");
} else {
  console.log(
    "Existing .env preserved; missing Garage secret files were initialized.",
  );
}

await writeFile(
  resolve(secretsDirectory, ".initialized"),
  "local-development-only\n",
  {
    mode: 0o600,
  },
);
