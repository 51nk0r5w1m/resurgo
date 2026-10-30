import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";

type DemoAccount = {
  email: string;
  name: string;
  password: string;
  totpSetupUri: string;
};

function totp(setupUri: string) {
  const secret = new URL(setupUri).searchParams.get("secret");
  if (!secret) throw new Error("Missing synthetic account TOTP secret");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secret.replaceAll("=", "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid synthetic account TOTP secret");
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

async function login(browser: Browser, account: DemoAccount) {
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
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
  return { context, page };
}

async function casePath(page: Page) {
  const href = await page
    .getByRole("link", { name: "Open populated case workspace" })
    .first()
    .getAttribute("href");
  if (!href) throw new Error("Synthetic demo case link missing");
  return href;
}

test("three independent accounts demonstrate settlement feasibility coordination", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const credentials = JSON.parse(
    await readFile(resolve(".secrets/demo-credentials.json"), "utf8"),
  ) as {
    accounts: Record<"attorney" | "client" | "lender", DemoAccount>;
  };
  await mkdir(resolve("artifacts/demo"), { recursive: true });

  const client = await login(browser, credentials.accounts.client);
  const attorney = await login(browser, credentials.accounts.attorney);
  const lender = await login(browser, credentials.accounts.lender);
  const root = await casePath(client.page);
  const attorneyRoot = await casePath(attorney.page);
  const lenderRoot = await casePath(lender.page);
  expect(attorneyRoot).toBe(root);
  expect(lenderRoot).toBe(root);

  await client.page.goto(`${root}/demo`);
  await expect(
    client.page.getByRole("heading", {
      name: "See the decision before the deadline becomes a problem.",
    }),
  ).toBeVisible();
  await expect(
    client.page.getByText("Fictional demonstration data"),
  ).toBeVisible();
  await client.page.screenshot({
    fullPage: true,
    path: "artifacts/demo/client-guide-desktop.png",
  });

  await client.page.goto(root);
  await expect(
    client.page.getByRole("heading", {
      name: /Good (morning|afternoon), Jordan/u,
    }),
  ).toBeVisible();
  await expect(client.page.getByText("5 available")).toBeVisible();
  await expect(client.page.getByText("3 participants")).toBeVisible();
  await client.page.screenshot({
    fullPage: true,
    path: "artifacts/demo/client-overview-desktop.png",
  });

  await client.page.goto(`${root}/documents`);
  await expect(client.page.getByText("5 records")).toBeVisible();
  const mortgageLink = client.page.getByRole("link", {
    name: "Fictional current mortgage statement",
  });
  const mortgageHref = await mortgageLink.getAttribute("href");
  const propertyHref = await client.page
    .getByRole("link", { name: "Fictional property ownership summary" })
    .getAttribute("href");
  if (!mortgageHref || !propertyHref)
    throw new Error("Demo document link missing");
  await mortgageLink.first().click();
  await expect(client.page.getByText(/version 1/i).first()).toBeVisible();
  await expect(client.page.locator("canvas").first()).toBeVisible();
  await client.page.screenshot({
    fullPage: true,
    path: "artifacts/demo/client-mortgage-preview.png",
  });

  await client.page.goto(`${root}/documents`);
  const settlementLink = client.page
    .getByRole("link", { name: "Fictional draft marital settlement agreement" })
    .first();
  const settlementHref = await settlementLink.getAttribute("href");
  if (!settlementHref) throw new Error("Demo settlement document link missing");
  await settlementLink.click();
  await expect(
    client.page.locator(".review-toolbar select").first().locator("option"),
  ).toHaveText(["Version 2 · available", "Version 1 · available"]);
  await client.page.screenshot({
    fullPage: true,
    path: "artifacts/demo/client-settlement-versions.png",
  });

  await client.page.goto(`${root}/reviews`);
  await expect(
    client.page.getByText(/90-day refinance condition has unresolved/u),
  ).toBeVisible();
  await expect(
    client.page.getByText(/Higher-rate refinancing may materially/u),
  ).toBeVisible();
  await expect(
    client.page.getByText(/revised settlement language/u),
  ).toBeVisible();
  await client.page.screenshot({
    fullPage: true,
    path: "artifacts/demo/client-review-register.png",
  });

  await lender.page.goto(`${root}/documents`);
  await expect(
    lender.page.getByRole("link", {
      name: "Fictional current mortgage statement",
    }),
  ).toBeVisible();
  await expect(
    lender.page.getByRole("link", {
      name: "Fictional financial disclosure worksheet",
    }),
  ).toBeVisible();
  await expect(
    lender.page.getByRole("link", {
      name: "Fictional property ownership summary",
    }),
  ).toHaveCount(0);
  await expect(
    lender.page.getByRole("link", {
      name: "Fictional draft marital settlement agreement",
    }),
  ).toHaveCount(0);
  const revokedResponse = await lender.page.goto(propertyHref);
  expect(revokedResponse?.status()).toBe(404);
  const legalResponse = await lender.page.goto(settlementHref);
  expect(legalResponse?.status()).toBe(404);
  await lender.page.goto(`${root}/reviews`);
  await expect(
    lender.page.getByRole("heading", {
      name: /90-day refinance condition has unresolved feasibility/u,
    }),
  ).toBeVisible();
  await expect(
    lender.page.getByText(/verify income, credit, debt ratios/iu),
  ).toBeVisible();
  await lender.page.screenshot({
    fullPage: true,
    path: "artifacts/demo/lender-workspace.png",
  });

  await attorney.page.goto(`${root}/documents`);
  await expect(
    attorney.page.getByRole("link", {
      name: "Fictional draft marital settlement agreement",
    }),
  ).toBeVisible();
  await expect(
    attorney.page.getByRole("link", {
      name: "Fictional current mortgage statement",
    }),
  ).toHaveCount(0);
  const restrictedMortgage = await attorney.page.goto(mortgageHref);
  expect(restrictedMortgage?.status()).toBe(404);
  await attorney.page.goto(`${root}/reviews`);
  await expect(
    attorney.page.getByText(/90-day refinance condition has unresolved/u),
  ).toBeVisible();
  await expect(
    attorney.page.getByText("Fictional current mortgage statement"),
  ).toHaveCount(0);
  await expect(
    attorney.page.getByText(/revised settlement language/u),
  ).toBeVisible();
  await attorney.page.screenshot({
    fullPage: true,
    path: "artifacts/demo/attorney-workspace.png",
  });

  const absent = await client.page.goto(
    `/cases/${randomUUID()}/documents/${randomUUID()}`,
  );
  expect(absent?.status()).toBe(404);

  await client.page.setViewportSize({ height: 844, width: 390 });
  await client.page.goto(`${root}/demo`);
  await client.page.screenshot({
    fullPage: true,
    path: "artifacts/demo/client-guide-mobile.png",
  });

  await Promise.all([
    client.context.close(),
    attorney.context.close(),
    lender.context.close(),
  ]);
});
