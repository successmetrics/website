import { test, expect } from "@playwright/test";

const siteUrl = process.env.NETLIFY_SITE_URL?.replace(/\/$/, "");

test.describe("Netlify form submissions (deployed site)", () => {
  test.skip(!siteUrl, "NETLIFY_SITE_URL is not set");

  test.use({ baseURL: siteUrl });

  test("contact form submits successfully", async ({ page }) => {
    const runId = Date.now();

    await page.goto("/contact.html");

    await page.locator("#name").fill("Netlify E2E Test");
    await page.locator("#email").fill(`contact-e2e+${runId}@example.com`);
    await page.locator("#phone").fill("+1 555 010 0199");
    await page.locator("#company").fill("SuccessMetrics QA");
    await page.locator("#interest").selectOption({ label: "Other" });
    await page
      .locator("#message")
      .fill(`Playwright Netlify contact test (${runId}). Safe to delete.`);

    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === "POST",
    );

    await page.locator('form[name="contact"] button[type="submit"]').click();
    const response = await responsePromise;

    expect(response.status()).toBeLessThan(400);

    const body = await page.content();
    expect(body).toMatch(/thank you|SuccessMetrics|Talk to an expert/i);
  });

  test("careers application API accepts resume upload", async ({ request }) => {
    test.skip(!siteUrl, "NETLIFY_SITE_URL is not set");
    test.skip(
      !process.env.NOTION_TOKEN || !process.env.NOTION_APPLICATIONS_DATABASE_ID,
      "Notion careers backend is not configured in CI",
    );

    const runId = Date.now();

    const response = await request.post(`${siteUrl}/api/job-application`, {
      multipart: {
        name: "Netlify E2E Test",
        email: `careers-e2e+${runId}@example.com`,
        phone: "+1 555 010 0199",
        position: "General Application",
        message: `Playwright careers API test (${runId}). Safe to delete.`,
        resume: {
          name: "ci-test-resume.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from(
            "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Size 3/Root 1 0 R>>\n%%EOF\n",
          ),
        },
      },
    });

    expect(response.status()).toBeLessThan(400);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
  });
});
