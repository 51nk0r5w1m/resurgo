import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const account = process.argv[2];
if (!["client", "attorney", "lender"].includes(account)) {
  throw new Error("Usage: pnpm demo:code <client|attorney|lender>");
}
const path = resolve(
  import.meta.dirname,
  "../../../.secrets/demo-credentials.json",
);
const credentials = JSON.parse(await readFile(path, "utf8"));
const setupUri = credentials.accounts[account].totpSetupUri;
const secret = new URL(setupUri).searchParams.get("secret");
if (!secret) throw new Error("Demo account has no TOTP secret");

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
let bits = "";
for (const character of secret.replaceAll("=", "").toUpperCase()) {
  const index = alphabet.indexOf(character);
  if (index < 0) throw new Error("Invalid TOTP secret");
  bits += index.toString(2).padStart(5, "0");
}
const bytes = [];
for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
  bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
}
const counter = Buffer.alloc(8);
counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
const offset = digest[digest.length - 1] & 0x0f;
const code =
  (((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3]) >>>
  0;
console.log(String(code % 1_000_000).padStart(6, "0"));
