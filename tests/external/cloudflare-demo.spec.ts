import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Browser } from "@playwright/test";

type DemoAccount = {
  email: string;
  password: string;
  totpSetupUri: string;
};

function totp(setupUri: string) {
  const secret = new URL(setupUri).searchParams.get("secret");
  if (!secret) throw new Error("Missing synthetic TOTP secret");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secret.replaceAll("=", "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid synthetic TOTP secret");
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
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    (((digest[offset]! & 0x7f) << 24) |
      (digest[offset + 1]! << 16) |
      (digest[offset + 2]! << 8) |
      digest[offset + 3]!) >>>
    0;
  return String(binary % 1_000_000).padStart(6, "0");
}

async function casePath(browser: Browser, account: DemoAccount, state: string) {
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/two-factor$/u);
  await page
    .getByLabel("Verification or backup code")
    .fill(totp(account.totpSetupUri));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
  const href = await page
    .locator('a[href^="/cases/"]')
    .first()
    .getAttribute("href");
  if (!href) throw new Error("Populated demonstration case is unavailable");
  return { context, href: href.replace(/\/reviews$/u, ""), page };
}

test("Cloudflare Access blocks a fresh unauthorized browser", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(baseURL!);
  const hostname = new URL(page.url()).hostname;
  expect(
    hostname.endsWith(".cloudflareaccess.com") || response?.status() === 403,
  ).toBe(true);
  await context.close();
});

test("approved reviewer can exercise the lender workspace through HTTPS", async ({
  browser,
  baseURL,
}) => {
  expect(new URL(baseURL!).protocol).toBe("https:");
  const state = process.env.RESURGO_CF_ACCESS_STORAGE_STATE;
  if (!state) throw new Error("RESURGO_CF_ACCESS_STORAGE_STATE is required");
  const credentials = JSON.parse(
    await readFile(resolve(".secrets/demo-credentials.json"), "utf8"),
  ) as { accounts: { lender: DemoAccount } };
  const lender = await casePath(browser, credentials.accounts.lender, state);

  await lender.page.goto(`${lender.href}/reviews`);
  await expect(
    lender.page.getByRole("heading", {
      name: /90-day refinance condition has unresolved feasibility/u,
    }),
  ).toBeVisible();
  await expect(lender.page.getByText("Whitney Owings")).toBeVisible();
  await expect(
    lender.page.getByText(/not a preapproval, underwriting approval/iu),
  ).toBeVisible();

  await lender.page.goto(`${lender.href}/documents`);
  await lender.page
    .getByRole("link", { name: "Fictional current mortgage statement" })
    .click();
  await expect(lender.page.locator("canvas").first()).toBeVisible();

  await lender.page.getByRole("button", { name: "Sign out" }).click();
  await expect(lender.page).toHaveURL(/\/login$/u);
  const protectedResponse = await lender.page.goto(lender.href);
  expect(protectedResponse?.url()).toContain("/login");
  await lender.context.close();
});
