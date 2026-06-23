import { test, expect } from "@playwright/test";
import {
  readJsonResponse,
  submitCareersForm,
  submitCareersDetailForm,
  submitContactForm,
  waitForCareersRoles,
} from "../helpers/forms-e2e.mjs";
import { loadCareerJobPages } from "../helpers/careers.mjs";

const siteUrl = process.env.NETLIFY_SITE_URL?.replace(/\/$/, "");
const careerJobs = loadCareerJobPages();

async function expectContactFormSuccess(page, response) {
  const payload = await readJsonResponse(response);

  if (response.status() === 503 && payload.reason === "missing_api_key") {
    await expect(page.locator("#form-status")).toContainText(/could not send/i);
    return payload;
  }

  expect(response.ok()).toBe(true);
  expect(payload.ok).toBe(true);
  expect(payload.ignored).toBeUndefined();
  expect(payload.emailSent).toBe(true);
  await expect(page.locator("#form-status")).toContainText(/thank you/i);
  return payload;
}

async function expectCareersFormSuccess(page, response) {
  const payload = await readJsonResponse(response);

  if (response.status() === 502) {
    await expect(page.locator("#form-status")).toContainText(
      /could not save|careers@successmetrics.io/i,
    );
    return payload;
  }

  expect(response.ok()).toBe(true);
  expect(payload.ok).toBe(true);
  expect(payload.ignored).toBeUndefined();
  expect(typeof payload.emailSent).toBe("boolean");
  await expect(page.locator("#form-status")).toContainText(/application was received/i);
  return payload;
}

async function expectHoneypotIgnored(page, response) {
  const payload = await readJsonResponse(response);
  expect(response.ok()).toBe(true);
  expect(payload).toEqual({ ok: true, ignored: true });
  await expect(page.locator("#form-status")).toContainText(/thank you|application was received/i);
}

test.describe("Deployed contact form submission", () => {
  test.skip(!siteUrl, "NETLIFY_SITE_URL is not set");

  test.use({ baseURL: siteUrl });

  test("submits through the contact page UI on the deployed site", async ({ page }) => {
    const runId = Date.now();

    await page.goto("/contact.html");
    const response = await submitContactForm(page, runId);
    await expectContactFormSuccess(page, response);
  });

  test("silently ignores honeypot spam on the deployed site", async ({ page }) => {
    const runId = Date.now();

    await page.goto("/contact.html");
    const response = await submitContactForm(page, runId, { honeypot: "definitely-a-bot" });
    await expectHoneypotIgnored(page, response);
  });
});

test.describe("Deployed careers form submission", () => {
  test.skip(!siteUrl, "NETLIFY_SITE_URL is not set");

  test.use({ baseURL: siteUrl });

  test("submits through the careers page UI on the deployed site", async ({ page }) => {
    const runId = Date.now();

    await page.goto("/careers.html");
    await waitForCareersRoles(page);

    const response = await submitCareersForm(page, runId);
    await expectCareersFormSuccess(page, response);
  });

  for (const job of careerJobs) {
    test(`submits through ${job.path} apply form on the deployed site`, async ({ page }) => {
      const runId = Date.now();

      await page.goto(job.path);
      await expect(page.locator("#job-application-form")).toBeVisible();

      const response = await submitCareersDetailForm(page, runId, { label: job.label });
      await expectCareersFormSuccess(page, response);
      await expect(page.locator("#role")).toHaveValue(job.label);
    });
  }
});
