import { describe, expect, it } from "vitest";
import { hasResendConfig, loadDotEnv, requireEnv } from "../helpers/env";
import { createTestResumeFile } from "../helpers/test-resume";
import { sendApplicationNotification } from "../../netlify/functions/shared/email.mjs";

loadDotEnv();

const resendConfigured = hasResendConfig();

describe.skipIf(!resendConfigured)("Resend careers email live API", () => {
  const runId = `ci-${Date.now()}`;

  it("sends a careers application notification using configured env vars", async () => {
    process.env.RESEND_FROM_EMAIL = requireEnv("RESEND_FROM_EMAIL");
    process.env.CAREERS_NOTIFY_EMAIL = requireEnv("CAREERS_NOTIFY_EMAIL");

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
