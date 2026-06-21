import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import jobApplicationHandler from "../../netlify/functions/job-application.mjs";
import jobsHandler from "../../netlify/functions/jobs.mjs";
import { createTestResumeFile, TEST_RESUME_BYTES } from "../helpers/test-resume";

function buildApplicationFormData(overrides: Record<string, string | File> = {}) {
  const formData = new FormData();
  formData.append("name", String(overrides.name ?? "Test Applicant"));
  formData.append("email", String(overrides.email ?? "careers@example.com"));
  formData.append("phone", String(overrides.phone ?? ""));
  formData.append("position", String(overrides.position ?? "General Application"));
  formData.append("message", String(overrides.message ?? "Test application"));
  formData.append(
    "resume",
    overrides.resume ??
      new File([TEST_RESUME_BYTES], "ci-test-resume.pdf", { type: "application/pdf" }),
  );
  if (overrides["bot-field"]) {
    formData.append("bot-field", String(overrides["bot-field"]));
  }
  return formData;
}

describe("Netlify function bundling safety", () => {
  it("notion helper does not declare __dirname (esbuild injects it on deploy)", () => {
    const source = readFileSync(
      join(process.cwd(), "netlify/functions/shared/notion.mjs"),
      "utf8",
    );
    expect(source).not.toMatch(/\bconst __dirname\b/);
  });
});

describe("jobs API handler", () => {
  it("returns a jobs payload without crashing", async () => {
    const response = await jobsHandler();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(payload.jobs)).toBe(true);
    expect(["notion", "fallback"]).toContain(payload.source);
  });
});

describe("job application API handler", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("rejects non-POST requests", async () => {
    const response = await jobApplicationHandler(
      new Request("http://localhost/api/job-application", { method: "GET" }),
    );
    expect(response.status).toBe(405);
  });

  it("silently ignores honeypot submissions", async () => {
    const response = await jobApplicationHandler(
      new Request("http://localhost/api/job-application", {
        method: "POST",
        body: buildApplicationFormData({ "bot-field": "spam" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, ignored: true });
  });

  it("requires core fields", async () => {
    const response = await jobApplicationHandler(
      new Request("http://localhost/api/job-application", {
        method: "POST",
        body: new FormData(),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/required/i);
  });

  it("returns 502 when Notion is not configured", async () => {
    process.env.NOTION_TOKEN = "";
    process.env.NOTION_APPLICATIONS_DATABASE_ID = "";

    const response = await jobApplicationHandler(
      new Request("http://localhost/api/job-application", {
        method: "POST",
        body: buildApplicationFormData(),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toMatch(/could not save your application/i);
  });
});
