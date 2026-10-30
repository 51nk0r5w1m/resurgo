import { expect, test, type APIRequestContext } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

async function verificationUrl(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  await expect
    .poll(
      async () => {
        const response = await request.get(
          "http://127.0.0.1:8025/view/latest.txt",
          { params: { query: `to:${email}` } },
        );
        return response.ok() ? response.text() : "";
      },
      { message: "verification message delivered to Mailpit", timeout: 15_000 },
    )
    .toContain("Verify your email");

  const response = await request.get("http://127.0.0.1:8025/view/latest.txt", {
    params: { query: `to:${email}` },
  });
  const body = await response.text();
  const [url] = body.match(/https?:\/\/[^\s]+/u) ?? [];
  if (!url) throw new Error("Verification message did not contain a URL");
  return url;
}

test("client registers, verifies, creates a private case, and builds a roadmap", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const email = `atlanta-client-${Date.now()}@resurgo.test`;
  const password = "Synthetic-Client-Password-42!";

  await page.goto("/register");
  await page.getByLabel("Your name").fill("Synthetic Atlanta Client");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create private account" }).click();
  await expect(page.getByRole("status")).toContainText("verify your email");

  await page.goto(await verificationUrl(request, email));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
  await expect(
    page.getByText("Start your transition without inviting"),
  ).toBeVisible();

  await page
    .getByLabel("Supported Superior Court jurisdiction")
    .selectOption("GA-FULTON-SUPERIOR");
  await page.getByRole("button", { name: "Create private case" }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+\/discovery$/u);
  await expect(
    page.getByText("Fulton County Superior Court").first(),
  ).toBeVisible();

  await page.getByLabel("We own property together").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { name: /mortgage connected/u }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: /mortgage connected/u }),
  ).toBeVisible();
  await page.getByLabel("Yes", { exact: true }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page
    .getByLabel("Business, investments, or complex assets are involved")
    .check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.getByLabel("Yes, include optional support resources").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByLabel("4 answers saved")).toBeVisible();
  await page.getByRole("button", { name: "Change answer" }).last().click();
  await page.getByLabel("Not right now").check();
  await page.getByRole("button", { name: "Save change" }).click();
  await page.getByRole("button", { name: "Change answer" }).last().click();
  await page.getByLabel("Yes, include optional support resources").check();
  await page.getByRole("button", { name: "Save change" }).click();
  await page.getByRole("button", { name: "Build my roadmap" }).click();

  await expect(
    page.getByRole("heading", { name: /coordination team/u }),
  ).toBeVisible();
  await expect(
    page.getByText("divorce attorney", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("mortgage specialist", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("financial specialist", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("personal support", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/not legal advice, a mortgage eligibility decision/u),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "Case workspace" })
    .getByRole("link", { name: "Documents" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Documents", exact: true }),
  ).toBeVisible();
  const syntheticPdf = await PDFDocument.create();
  syntheticPdf.addPage([612, 792]);
  const uploadRegion = page.getByRole("region", { name: "Upload document" });
  await uploadRegion.getByLabel("Information domain").selectOption("financial");
  await uploadRegion
    .getByLabel("Confidentiality")
    .selectOption("financial_restricted");
  await uploadRegion.getByLabel("Choose PDF or DOCX files").setInputFiles({
    buffer: Buffer.from(await syntheticPdf.save()),
    mimeType: "application/pdf",
    name: "synthetic-mortgage-statement.pdf",
  });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith("/documents") &&
        response.request().method() === "POST",
    ),
    uploadRegion.getByRole("button", { name: "Upload 1 securely" }).click(),
  ]);
  await expect(uploadRegion.getByRole("status")).toContainText(
    "1 of 1 files uploaded to quarantine",
  );
  await expect(uploadRegion.getByRole("status")).toContainText(
    "1 of 1 files uploaded to quarantine",
  );
  const pdfRow = page
    .locator(".document-table li")
    .filter({ hasText: "synthetic-mortgage-statement" });
  await expect
    .poll(
      async () => {
        await page.reload();
        return pdfRow.locator(".document-status").textContent();
      },
      { timeout: 30_000 },
    )
    .toContain("available");
  await pdfRow
    .getByRole("link", { name: /synthetic-mortgage-statement/u })
    .click();
  const privateDocumentUrl = page.url();
  await expect(page.locator("canvas")).toBeVisible();
  await page
    .getByPlaceholder("Add a question, clarification, or review note…")
    .fill("Please confirm this synthetic mortgage balance.");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith("/comments") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Add comment" }).click(),
  ]);
  await page.reload();
  await expect(
    page.getByText("Please confirm this synthetic mortgage balance."),
  ).toBeVisible();
  const revisedPdf = await PDFDocument.create();
  revisedPdf.addPage([612, 792]);
  await page.getByLabel("Choose revised PDF file").setInputFiles({
    buffer: Buffer.from(await revisedPdf.save()),
    mimeType: "application/pdf",
    name: "synthetic-mortgage-statement-v2.pdf",
  });
  await page.getByRole("button", { name: "Upload new version" }).click();
  await expect
    .poll(
      async () => {
        await page.reload();
        return page
          .locator(".review-toolbar select")
          .first()
          .locator("option")
          .allTextContents();
      },
      { timeout: 30_000 },
    )
    .toContain("Version 2 · available");
  await page
    .locator(".review-toolbar select")
    .first()
    .selectOption({ label: "Version 2 · available" });
  await page.getByLabel("Compare with").selectOption({ label: "Version 1" });
  await expect(page.locator(".viewer-comparison canvas")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download version" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/u);

  await page
    .getByRole("navigation", { name: "Case workspace" })
    .getByRole("link", { name: "Documents" })
    .click();
  await uploadRegion.getByLabel("Information domain").selectOption("legal");
  await uploadRegion
    .getByLabel("Choose PDF or DOCX files")
    .setInputFiles("tests/fixtures/synthetic-property-summary.docx");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith("/documents") &&
        response.request().method() === "POST",
    ),
    uploadRegion.getByRole("button", { name: "Upload 1 securely" }).click(),
  ]);
  await expect(uploadRegion.getByRole("status")).toContainText(
    "1 of 1 files uploaded to quarantine",
  );
  const docxRow = page
    .locator(".document-table li")
    .filter({ hasText: "synthetic-property-summary" });
  await expect
    .poll(
      async () => {
        await page.reload();
        return docxRow.locator(".document-status").textContent();
      },
      { timeout: 30_000 },
    )
    .toContain("available");
  await docxRow
    .getByRole("link", { name: /synthetic-property-summary/u })
    .click();
  await expect(
    page.getByText("Synthetic Resurgo property transition summary").last(),
  ).toBeVisible({ timeout: 20_000 });

  await page
    .getByRole("navigation", { name: "Case workspace" })
    .getByRole("link", { name: "Documents" })
    .click();
  await page.getByPlaceholder("Search documents…").fill("mortgage");
  await expect(
    page.getByRole("link", { name: "synthetic-mortgage-statement" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "synthetic-property-summary" }),
  ).toHaveCount(0);
  await page.getByPlaceholder("Search documents…").clear();
  await page
    .getByLabel("Request title")
    .fill("Synthetic property appraisal request");
  await page
    .getByRole("region", { name: "Document requests" })
    .getByLabel("Information domain")
    .selectOption("financial");
  await page
    .getByLabel("What is needed?")
    .fill("Provide a synthetic appraisal for professional review.");
  await page.getByRole("button", { name: "Add document request" }).click();
  await expect(page.getByRole("status").last()).toContainText(
    "Document request added",
  );
  await expect(
    page.getByRole("heading", { name: "Synthetic property appraisal request" }),
  ).toBeVisible();

  await page.goto("/dashboard");
  await expect(
    page.getByRole("link", { name: "Continue guided discovery" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/u);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/u);

  const unrelatedEmail = `unrelated-client-${Date.now()}@resurgo.test`;
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Synthetic Unrelated Client");
  await page.getByLabel("Email address").fill(unrelatedEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create private account" }).click();
  await page.goto(await verificationUrl(request, unrelatedEmail));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(unrelatedEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
  const denied = await page.goto(privateDocumentUrl);
  expect(denied?.status()).toBe(404);
});
