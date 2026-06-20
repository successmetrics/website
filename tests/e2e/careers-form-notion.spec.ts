import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import {
  submitCareersForm,
  waitForCareersRoles,
} from "../helpers/forms-e2e.mjs";

function loadDotEnv(path = join(process.cwd(), ".env")) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const notionConfigured = Boolean(
  process.env.NOTION_TOKEN?.trim() &&
    process.env.NOTION_JOBS_DATABASE_ID?.trim() &&
    process.env.NOTION_APPLICATIONS_DATABASE_ID?.trim(),
);

test.describe("Careers form submission → Notion", () => {
  test.skip(!notionConfigured, "NOTION_* env vars are not set");

  test("submits the careers form and creates a row in Notion", async ({ page }) => {
    const { findApplicationsByEmail, readApplicationPage } = await import(
      "../../netlify/functions/shared/notion.mjs"
    );

    const runId = Date.now();
    const name = "Careers Form E2E";
    const email = `careers-form+${runId}@example.com`;
    const message = `Playwright careers form test (${runId}). Safe to delete.`;

    await page.goto("/careers.html");
    await expect(page.locator("#job-application-form")).toBeVisible();
    await waitForCareersRoles(page);

    const response = await submitCareersForm(page, runId, { name, email, message });
    expect(response.ok()).toBe(true);

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.notionPageId).toBeTruthy();

    await expect(page.locator("#form-status")).toContainText(/application was received/i);

    let application = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const pages = await findApplicationsByEmail(email);
      if (pages.length > 0) {
        application = readApplicationPage(pages[0]);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(application).not.toBeNull();
    expect(application).toMatchObject({
      name,
      email,
      phone: "+1 555 010 0199",
      position: "General Application",
      status: "New",
    });
    expect(application?.message).toContain(String(runId));
    expect(application?.id).toBe(payload.notionPageId);
    expect(application?.hasResume).toBe(true);
  });
});
