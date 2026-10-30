import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Browser journeys share the local database, Mailpit inbox, auth rate-limit
  // store, and one document worker. Serialize them so the suite validates real
  // workflows without introducing cross-test infrastructure races.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "NODE_ENV=production NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100 pnpm --filter @resurgo/web exec next start --hostname 127.0.0.1 --port 3100",
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:3100",
  },
});
