import { describe, expect, it } from "vitest";
import { hasResendConfig, loadDotEnv, requireEnv } from "../helpers/env";
import { sendContactNotification } from "../../netlify/functions/shared/email.mjs";

loadDotEnv();

const resendConfigured = hasResendConfig();

describe.skipIf(!resendConfigured)("Resend contact email live API", () => {
  const runId = `ci-${Date.now()}`;

  it("sends a contact form notification using configured env vars", async () => {
    process.env.RESEND_CONTACT_FROM_EMAIL =
      process.env.RESEND_CONTACT_FROM_EMAIL?.trim() || requireEnv("RESEND_FROM_EMAIL");
    process.env.RESEND_FROM_EMAIL = requireEnv("RESEND_FROM_EMAIL");
    process.env.CONTACT_NOTIFY_EMAIL = requireEnv("CONTACT_NOTIFY_EMAIL");

    const result = await sendContactNotification({
      name: "Resend Contact CI Test",
      email: `contact-resend+${runId}@example.com`,
      phone: "+1 555 010 0199",
      company: "SuccessMetrics QA",
      interest: "Free Salesforce Assessment",
      message: `Automated Resend contact test (${runId}). Safe to delete.`,
    });

    expect(result.sent).toBe(true);
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
