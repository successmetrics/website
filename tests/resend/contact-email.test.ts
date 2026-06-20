import { describe, expect, it } from "vitest";
import { hasResendConfig, loadDotEnv } from "../helpers/env";
import { sendContactNotification } from "../../netlify/functions/shared/email.mjs";

loadDotEnv();

const resendConfigured = hasResendConfig();
const VERIFIED_FROM = "SuccessMetrics <sduraisamy@successmetrics.io>";
const NOTIFY_TO = "aditya@successmetrics.io";

describe.skipIf(!resendConfigured)("Resend contact email live API", () => {
  const runId = `ci-${Date.now()}`;

  it("sends a contact form notification from sduraisamy@ to aditya@", async () => {
    process.env.RESEND_CONTACT_FROM_EMAIL = VERIFIED_FROM;
    process.env.RESEND_FROM_EMAIL = VERIFIED_FROM;
    process.env.CONTACT_NOTIFY_EMAIL = NOTIFY_TO;

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
