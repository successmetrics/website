import { afterEach, describe, expect, it } from "vitest";
import { sendContactNotification } from "../../netlify/functions/shared/email.mjs";

describe("contact email helper", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("skips sending when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendContactNotification({
      name: "Test Contact",
      email: "contact@example.com",
      phone: "",
      company: "Example Co",
      interest: "Free Salesforce Assessment",
      message: "Test message",
    });

    expect(result).toEqual({ sent: false, reason: "missing_api_key" });
  });
});
