import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  sendApplicationNotification,
  sendContactNotification,
} from "../netlify/functions/shared/email.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFIED_FROM = "SuccessMetrics <sduraisamy@successmetrics.io>";
const NOTIFY_TO = "aditya@successmetrics.io";

function loadDotEnv(path = join(ROOT, ".env")) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const apiKey = process.env.RESEND_API_KEY?.trim();
if (!apiKey) {
  console.error("RESEND_API_KEY is missing. Copy .env.example to .env first.");
  process.exit(1);
}

process.env.RESEND_FROM_EMAIL = VERIFIED_FROM;
process.env.RESEND_CONTACT_FROM_EMAIL = VERIFIED_FROM;
process.env.CAREERS_NOTIFY_EMAIL = NOTIFY_TO;
process.env.CONTACT_NOTIFY_EMAIL = NOTIFY_TO;

const runId = Date.now();

console.log("Checking Resend email notifications...\n");
console.log(`From: ${VERIFIED_FROM}`);
console.log(`To: ${NOTIFY_TO}`);

try {
  const careersResult = await sendApplicationNotification({
    name: "Resend Verify",
    email: `resend-careers+${runId}@example.com`,
    phone: "+1 555 010 0199",
    position: "General Application",
    linkedin: "",
    message: `Resend careers verify (${runId}). Safe to delete.`,
    resumeFile: null,
  });

  if (!careersResult.sent) {
    console.error("\nCareers verify failed:", careersResult);
    process.exit(1);
  }

  console.log(`Careers OK — message id: ${careersResult.id}`);

  const contactResult = await sendContactNotification({
    name: "Resend Verify",
    email: `resend-contact+${runId}@example.com`,
    phone: "+1 555 010 0199",
    company: "SuccessMetrics QA",
    interest: "Free Salesforce Assessment",
    message: `Resend contact verify (${runId}). Safe to delete.`,
  });

  if (!contactResult.sent) {
    console.error("\nContact verify failed:", contactResult);
    process.exit(1);
  }

  console.log(`Contact OK — message id: ${contactResult.id}`);
} catch (error) {
  console.error("\nResend verify failed:");
  console.error(`  ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
