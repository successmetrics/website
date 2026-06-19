import { afterEach, describe, expect, it } from "vitest";
import { sendApplicationNotification } from "../../netlify/functions/shared/email.mjs";

describe("careers email helper", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("skips sending when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendApplicationNotification({
      name: "Test Applicant",
      email: "applicant@example.com",
      phone: "",
      position: "General Application",
      linkedin: "",
      message: "Test message",
      resumeFile: null,
    });

    expect(result).toEqual({ sent: false, reason: "missing_api_key" });
  });
});
