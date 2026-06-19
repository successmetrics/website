import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasResendConfig, loadDotEnv } from "../helpers/env";
import { createTestResumeFile } from "../helpers/test-resume";
import { sendApplicationNotification } from "../../netlify/functions/shared/email.mjs";

loadDotEnv();

const resendConfigured = hasResendConfig();
const SANDBOX_FROM = "SuccessMetrics Careers <onboarding@resend.dev>";

describe.skipIf(!resendConfigured)("Resend careers email live API", () => {
  const runId = `ci-${Date.now()}`;
  const previousFrom = process.env.RESEND_FROM_EMAIL;

  beforeAll(() => {
    process.env.RESEND_FROM_EMAIL = SANDBOX_FROM;
  });

  afterAll(() => {
    if (previousFrom === undefined) {
      delete process.env.RESEND_FROM_EMAIL;
    } else {
      process.env.RESEND_FROM_EMAIL = previousFrom;
    }
  });

  it("sends a careers application notification with resume attachment", async () => {
    const notifyEmail = process.env.CAREERS_NOTIFY_EMAIL?.trim();
    if (!notifyEmail) {
      throw new Error(
        "CAREERS_NOTIFY_EMAIL is not set. With onboarding@resend.dev, this must be the email on your Resend account.",
      );
    }

    const result = await sendApplicationNotification({
      name: "Resend CI Test",
      email: `resend-test+${runId}@example.com`,
      phone: "+1 555 010 0199",
      position: "General Application",
      linkedin: "https://linkedin.com/in/resend-ci-test",
      message: `Automated Resend careers test (${runId}). Safe to delete.`,
      resumeFile: createTestResumeFile(),
    });

    expect(result.sent).toBe(true);
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
