export const TEST_RESUME = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Size 3/Root 1 0 R>>\n%%EOF\n",
);

export async function waitForCareersRoles(page) {
  await page.locator("#job-list").waitFor({ state: "attached" });
  await page.waitForFunction(
    () => document.querySelector("#job-list")?.getAttribute("data-state") === "ready",
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector('#role option[value="General Application"]'),
      ),
    undefined,
    { timeout: 15_000 },
  );
}

export async function waitForCareersDetailRole(page, expectedLabel) {
  await page.waitForFunction(
    (label) => document.querySelector("#role")?.value === label,
    expectedLabel,
    { timeout: 15_000 },
  );
}

async function fillHoneypot(page, value) {
  await page.evaluate((spam) => {
    const input = document.querySelector('input[name="bot-field"]');
    if (input instanceof HTMLInputElement) {
      input.value = spam;
    }
  }, value);
}

export async function fillContactForm(page, runId, overrides = {}) {
  const submission = {
    name: overrides.name ?? "Form E2E Test",
    email: overrides.email ?? `contact-form+${runId}@example.com`,
    phone: overrides.phone ?? "+1 555 010 0199",
    company: overrides.company ?? "SuccessMetrics QA",
    interest: overrides.interest ?? "Other",
    message: overrides.message ?? `Playwright contact form test (${runId}). Safe to delete.`,
    honeypot: overrides.honeypot ?? "",
  };

  await page.locator("#name").fill(submission.name);
  await page.locator("#email").fill(submission.email);
  await page.locator("#phone").fill(submission.phone);
  await page.locator("#company").fill(submission.company);
  await page.locator("#interest").selectOption({ label: submission.interest });
  await page.locator("#message").fill(submission.message);

  if (submission.honeypot) {
    await fillHoneypot(page, submission.honeypot);
  }
}

export async function fillCareersForm(page, runId, overrides = {}) {
  const submission = {
    name: overrides.name ?? "Form E2E Test",
    email: overrides.email ?? `careers-form+${runId}@example.com`,
    phone: overrides.phone ?? "+1 555 010 0199",
    position: overrides.position ?? "General Application",
    message: overrides.message ?? `Playwright careers form test (${runId}). Safe to delete.`,
    includeResume: overrides.includeResume ?? true,
    honeypot: overrides.honeypot ?? "",
  };

  await page.locator("#name").fill(submission.name);
  await page.locator("#email").fill(submission.email);
  await page.locator("#phone").fill(submission.phone);
  await page.locator("#role").selectOption(submission.position);
  await page.locator("#message").fill(submission.message);

  if (submission.includeResume) {
    await page.locator("#resume").setInputFiles({
      name: "ci-test-resume.pdf",
      mimeType: "application/pdf",
      buffer: TEST_RESUME,
    });
  }

  if (submission.honeypot) {
    await fillHoneypot(page, submission.honeypot);
  }
}

export function waitForContactApiPost(page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/api/contact") && response.request().method() === "POST",
  );
}

export function waitForCareersApiPost(page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/api/job-application") &&
      response.request().method() === "POST",
  );
}

export async function submitContactForm(page, runId, overrides) {
  await fillContactForm(page, runId, overrides);
  const responsePromise = waitForContactApiPost(page);
  await page.locator('#contact-form button[type="submit"]').click();
  return responsePromise;
}

export async function submitCareersForm(page, runId, overrides) {
  await fillCareersForm(page, runId, overrides);
  const responsePromise = waitForCareersApiPost(page);
  await page.getByRole("button", { name: "Submit Application →" }).click();
  return responsePromise;
}

export async function submitCareersDetailForm(page, runId, { label, ...overrides }) {
  await waitForCareersDetailRole(page, label);
  return submitCareersForm(page, runId, { position: label, ...overrides });
}

export async function readJsonResponse(response) {
  return response.json();
}
