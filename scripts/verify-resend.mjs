import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sendApplicationNotification } from "../netlify/functions/shared/email.mjs";

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

loadDotEnv();

const apiKey = process.env.RESEND_API_KEY?.trim();
if (!apiKey) {
  console.error("RESEND_API_KEY is missing. Copy .env.example to .env first.");
  process.exit(1);
}

const notifyEmail = process.env.CAREERS_NOTIFY_EMAIL?.trim();
if (!notifyEmail) {
  console.error("CAREERS_NOTIFY_EMAIL is not set.");
  process.exit(1);
}

console.log("Checking Resend careers email setup...\n");
console.log(`Notify inbox: ${notifyEmail}`);
console.log(`From (production): ${process.env.RESEND_FROM_EMAIL || "SuccessMetrics Careers <onboarding@resend.dev>"}`);

const previousFrom = process.env.RESEND_FROM_EMAIL;
process.env.RESEND_FROM_EMAIL = "SuccessMetrics Careers <onboarding@resend.dev>";

const runId = Date.now();

try {
  const result = await sendApplicationNotification({
    name: "Resend Verify",
    email: `resend-verify+${runId}@example.com`,
    phone: "+1 555 010 0199",
    position: "General Application",
    linkedin: "",
    message: `Resend verify script (${runId}). Safe to delete.`,
    resumeFile: null,
  });

  if (!result.sent) {
    console.error("\nResend verify failed:", result);
    process.exit(1);
  }

  console.log(`\nResend OK — message id: ${result.id}`);
  console.log(
    "\nNote: this script uses onboarding@resend.dev, which only delivers to your Resend account email.",
  );
  console.log("Set CAREERS_NOTIFY_EMAIL to that address for local tests.");
} catch (error) {
  console.error("\nResend verify failed:");
  console.error(`  ${error instanceof Error ? error.message : error}`);
  console.error(
    "\nIf you see a domain error, production needs a verified domain in Resend.",
  );
  console.error(
    "For local tests, CAREERS_NOTIFY_EMAIL must match your Resend account email.",
  );
  process.exit(1);
} finally {
  if (previousFrom === undefined) {
    delete process.env.RESEND_FROM_EMAIL;
  } else {
    process.env.RESEND_FROM_EMAIL = previousFrom;
  }
}
