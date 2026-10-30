import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

import { ensurePrivateDirectory, writeExclusive } from "./lib/secure-files.mjs";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");
const secretsDirectory = resolve(root, ".secrets");

function randomHex(bytes) {
  return randomBytes(bytes).toString("hex");
}

await ensurePrivateDirectory(secretsDirectory);

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
  await writeExclusive(path, `${secret}\n`);
}

if (envCreated) {
  console.log("Created local .env and Garage secret files.");
} else {
  console.log(
    "Existing .env preserved; missing Garage secret files were initialized.",
  );
}

await writeExclusive(
  resolve(secretsDirectory, ".initialized"),
  "local-development-only\n",
);
