import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

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
const TEST_RESUME = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Size 3/Root 1 0 R>>\n%%EOF\n",
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
    await expect(page.locator("#job-list")).toHaveAttribute("data-state", "ready", {
      timeout: 15000,
    });
    await expect(page.locator('#role option[value="General Application"]')).toHaveCount(1, {
      timeout: 15000,
    });

    await page.locator("#name").fill(name);
    await page.locator("#email").fill(email);
    await page.locator("#phone").fill("+1 555 010 0199");
    await page.locator("#role").selectOption("General Application");
    await page.locator("#message").fill(message);
    await page.locator("#resume").setInputFiles({
      name: "ci-test-resume.pdf",
      mimeType: "application/pdf",
      buffer: TEST_RESUME,
    });

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/job-application") &&
        response.request().method() === "POST",
    );

    await page.getByRole("button", { name: "Submit Application →" }).click();

    const response = await responsePromise;
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
