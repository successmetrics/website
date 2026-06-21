import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  sendApplicationNotification,
  sendContactNotification,
} from "../netlify/functions/shared/email.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is missing. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

loadDotEnv();

requireEnv("RESEND_API_KEY");
const fromEmail = requireEnv("RESEND_FROM_EMAIL");
const notifyTo = requireEnv("CONTACT_NOTIFY_EMAIL");

process.env.RESEND_CONTACT_FROM_EMAIL =
  process.env.RESEND_CONTACT_FROM_EMAIL?.trim() || fromEmail;
process.env.CAREERS_NOTIFY_EMAIL =
  process.env.CAREERS_NOTIFY_EMAIL?.trim() || notifyTo;

const runId = Date.now();

console.log("Checking Resend email notifications...\n");
console.log(`From: ${fromEmail}`);
console.log(`To: ${notifyTo}`);

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
