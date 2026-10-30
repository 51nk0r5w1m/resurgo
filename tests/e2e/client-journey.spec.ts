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
  test.setTimeout(60_000);
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
  await expect(page.getByText("Fulton County Superior Court")).toBeVisible();

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

  await page.getByRole("link", { name: "Documents" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Documents stay within their boundaries.",
    }),
  ).toBeVisible();
  const syntheticPdf = await PDFDocument.create();
  syntheticPdf.addPage([612, 792]);
  const uploadRegion = page.getByRole("region", { name: "Upload document" });
  await uploadRegion
    .getByLabel("Document title")
    .fill("Synthetic mortgage statement");
  await uploadRegion.getByLabel("Information domain").selectOption("financial");
  await page.getByLabel("Confidentiality").selectOption("financial_restricted");
  await page.getByLabel("PDF or DOCX file").setInputFiles({
    buffer: Buffer.from(await syntheticPdf.save()),
    mimeType: "application/pdf",
    name: "synthetic-mortgage-statement.pdf",
  });
  await uploadRegion.getByRole("button", { name: "Upload securely" }).click();
  await expect(uploadRegion.getByRole("status")).toContainText(
    "It remains unavailable while validation and malware scanning run.",
  );
  await expect(
    page.getByRole("heading", { name: "Synthetic mortgage statement" }),
  ).toBeVisible();
  const processingStatus = page.locator(".document-status");
  await expect(processingStatus).toHaveText(
    /^(quarantined|processing|available)$/u,
  );
  if ((await processingStatus.textContent()) === "available") {
    await expect(page.getByRole("link", { name: "Preview" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: "Preview" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Download" })).toHaveCount(0);
  }
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
});
