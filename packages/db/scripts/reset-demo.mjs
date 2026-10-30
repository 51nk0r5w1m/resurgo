import pg from "pg";

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL is required");
const parsed = new URL(sourceUrl);
if (
  process.env.NODE_ENV === "production" ||
  !["127.0.0.1", "localhost"].includes(parsed.hostname)
) {
  throw new Error(
    "Demo reset is restricted to a loopback development database",
  );
}
const confirmation = process.argv[2];
if (confirmation !== "--confirm-local-data-loss") {
  throw new Error(
    "Pass --confirm-local-data-loss to reset the local demo database",
  );
}

const client = new pg.Client({ connectionString: sourceUrl });
try {
  await client.connect();
  await client.query("drop schema if exists auth cascade");
  await client.query("drop schema if exists resurgo cascade");
  await client.query("drop schema if exists drizzle cascade");
  console.log("Local Resurgo database schemas reset.");
} finally {
  await client.end();
}
