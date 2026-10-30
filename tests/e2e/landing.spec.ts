import { expect, test } from "@playwright/test";

test("shows the branded foundation without future feature controls", async ({
  page,
}) => {
  const response = await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Navigate today. Build tomorrow.",
  );
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start privately" }).first(),
  ).toHaveCSS("color", "rgb(251, 248, 239)");
  await expect(
    page.getByText("Privacy by design", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("horizon-scene")).toBeVisible();
  await expect(page.locator('[data-landscape-layer="ridge"]')).toHaveCount(3);
  await expect(page.locator('[data-landscape-layer="path"]')).toHaveCount(1);
  await expect(page.getByRole("link", { name: /sign in/i })).toHaveAttribute(
    "href",
    "/login",
  );
  await expect(
    page.getByRole("button", { name: /upload|generate|connect/i }),
  ).toHaveCount(0);

  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["content-security-policy"]).toContain(
    "object-src 'none'",
  );
});

test("primary calls to action lead to real page sections", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page.locator("#how-it-works")).toBeInViewport();
});
