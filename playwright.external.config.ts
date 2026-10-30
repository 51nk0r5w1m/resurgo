import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.RESURGO_EXTERNAL_BASE_URL;
if (!baseURL) {
  throw new Error("RESURGO_EXTERNAL_BASE_URL is required");
}

export default defineConfig({
  testDir: "./tests/external",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "external-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
