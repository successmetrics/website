import { defineConfig, devices } from "@playwright/test";

const siteUrl = process.env.NETLIFY_SITE_URL?.replace(/\/$/, "");

if (!siteUrl) {
  throw new Error("NETLIFY_SITE_URL is required for deployed form browser tests.");
}

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "netlify-forms.spec.mjs",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: siteUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
