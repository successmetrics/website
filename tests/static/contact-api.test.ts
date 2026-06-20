import { afterEach, describe, expect, it } from "vitest";
import contactHandler from "../../netlify/functions/contact.mjs";

function buildContactFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.append("name", overrides.name ?? "Test Contact");
  formData.append("email", overrides.email ?? "contact@example.com");
  formData.append("phone", overrides.phone ?? "");
  formData.append("company", overrides.company ?? "Example Co");
  formData.append("interest", overrides.interest ?? "Free Salesforce Assessment");
  formData.append("message", overrides.message ?? "Test message");
  if (overrides["bot-field"]) {
    formData.append("bot-field", overrides["bot-field"]);
  }
  return formData;
}

describe("contact API handler", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("rejects non-POST requests", async () => {
    const response = await contactHandler(
      new Request("http://localhost/api/contact", { method: "GET" }),
    );
    expect(response.status).toBe(405);
  });

  it("silently ignores honeypot submissions", async () => {
    const response = await contactHandler(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: buildContactFormData({ "bot-field": "spam" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, ignored: true });
  });

  it("requires core fields", async () => {
    const response = await contactHandler(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: new FormData(),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/required/i);
  });

  it("returns 503 when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const response = await contactHandler(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: buildContactFormData(),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toMatch(/could not send your message/i);
    expect(payload.reason).toBe("missing_api_key");
  });
});
