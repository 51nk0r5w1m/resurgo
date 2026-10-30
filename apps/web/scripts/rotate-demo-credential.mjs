import { createHmac, randomBytes } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const role = process.argv[2];
if (!["client", "attorney", "lender"].includes(role)) {
  throw new Error(
    "Usage: pnpm demo:rotate-credential <client|attorney|lender>",
  );
}

const credentialsPath = resolve(
  import.meta.dirname,
  "../../../.secrets/demo-credentials.json",
);
const credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
const account = credentials.accounts[role];
if (!account) throw new Error(`No ${role} demo account is configured`);

function currentTotp(setupUri) {
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
  const digest = createHmac("sha1", Buffer.from(bytes))
    .update(counter)
    .digest();
  const offset = digest.at(-1) & 0x0f;
  const code =
    (((digest[offset] & 0x7f) << 24) |
      (digest[offset + 1] << 16) |
      (digest[offset + 2] << 8) |
      digest[offset + 3]) >>>
    0;
  return String(code % 1_000_000).padStart(6, "0");
}

const cookies = new Map();
function retainCookies(response) {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(";", 1)[0];
    const separator = pair.indexOf("=");
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}
function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

const origin = "http://127.0.0.1:3000";
const request = async (path, body) => {
  const response = await fetch(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(),
      origin,
    },
    body: JSON.stringify(body),
  });
  retainCookies(response);
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw new Error(`Demo credential rotation failed at ${path}`);
  }
  return payload;
};

const signIn = await request("/sign-in/email", {
  email: account.email,
  password: account.password,
  rememberMe: false,
});
if (signIn?.twoFactorRedirect !== true) {
  throw new Error("Demo account did not request two-factor verification");
}
await request("/two-factor/verify-totp", {
  code: currentTotp(account.totpSetupUri),
  trustDevice: false,
});

const nextPassword = `R!${randomBytes(32).toString("base64url")}`;
await request("/change-password", {
  currentPassword: account.password,
  newPassword: nextPassword,
  revokeOtherSessions: true,
});

credentials.generatedAt = new Date().toISOString();
credentials.accounts[role].password = nextPassword;
const temporaryPath = `${credentialsPath}.${process.pid}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(credentials, null, 2)}\n`, {
  flag: "wx",
  mode: 0o600,
});
await chmod(temporaryPath, 0o600);
await rename(temporaryPath, credentialsPath);
await chmod(credentialsPath, 0o600);

console.log(
  `${role} demo credentials rotated. Retrieve them from .secrets/demo-credentials.json.`,
);
