import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const NETLIFY_FORMS_DASHBOARD =
  "https://app.netlify.com/projects/successmetrics/forms";

export const NETLIFY_FORMS = {
  contact: {
    page: "contact.html",
    name: "contact",
    api: "/api/contact",
    fields: ["name", "email", "phone", "company", "interest", "message"] as const,
  },
  jobApplication: {
    page: "careers.html",
    name: "job-application",
    api: "/api/job-application",
    fields: ["name", "email", "phone", "position", "linkedin", "resume", "message"] as const,
  },
} as const;

export function getNetlifySiteUrl(): string | undefined {
  const url = process.env.NETLIFY_SITE_URL?.trim();
  if (!url) return undefined;
  return url.replace(/\/$/, "");
}

export function readNetlifyToml(): string | null {
  const path = join(process.cwd(), "netlify.toml");
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

/** Netlify Forms accept POSTs at the site root (not the page path). */
export function netlifyFormEndpoint(siteUrl: string): string {
  return `${siteUrl}/`;
}

export function buildContactApiPayload(runId: string): FormData {
  const formData = new FormData();
  formData.append("name", "Netlify CI Test");
  formData.append("email", `contact-test+${runId}@example.com`);
  formData.append("phone", "+1 555 010 0199");
  formData.append("company", "SuccessMetrics QA");
  formData.append("interest", "Other");
  formData.append(
    "message",
    `Automated contact API test (${runId}). Safe to delete.`,
  );
  return formData;
}

/** @deprecated Contact form now uses /api/contact instead of Netlify Forms POST. */
export function buildContactPayload(runId: string): URLSearchParams {
  return new URLSearchParams({
    "form-name": NETLIFY_FORMS.contact.name,
    name: "Netlify CI Test",
    email: `contact-test+${runId}@example.com`,
    phone: "+1 555 010 0199",
    company: "SuccessMetrics QA",
    interest: "Other",
    message: `Automated Netlify contact form test (${runId}). Safe to delete.`,
  });
}

export function buildJobApplicationFormData(runId: string): FormData {
  const formData = new FormData();
  formData.append("form-name", NETLIFY_FORMS.jobApplication.name);
  formData.append("name", "Netlify CI Test");
  formData.append("email", `careers-test+${runId}@example.com`);
  formData.append("phone", "+1 555 010 0199");
  formData.append("position", "General Application");
  formData.append(
    "message",
    `Automated Netlify careers form test (${runId}). Safe to delete.`,
  );
  formData.append(
    "resume",
    new Blob(
      [
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Size 3/Root 1 0 R>>\n%%EOF\n",
      ],
      { type: "application/pdf" },
    ),
    "ci-test-resume.pdf",
  );
  return formData;
}

export function isNetlifySuccessResponse(status: number, body: string): boolean {
  if (status >= 200 && status < 400) return true;
  return /thank you|submission received|success/i.test(body);
}

export function isWixResponse(headers: Headers): boolean {
  return headers.has("x-wix-request-id");
}

/** Netlify removes data-netlify from HTML after deploy; check registered form markup instead. */
export function hasDeployedNetlifyForm(html: string, formName: string): boolean {
  const hasFormName =
    html.includes(`name="${formName}"`) || html.includes(`name='${formName}'`);
  const hasFormNameField =
    html.includes(`name="form-name" value="${formName}"`) ||
    html.includes(`name='form-name' value='${formName}'`);
  const hasHoneypot = html.includes('name="bot-field"') || html.includes("name='bot-field'");

  return hasFormName && hasFormNameField && hasHoneypot;
}

export async function assertNetlifySiteReady(siteUrl: string): Promise<void> {
  const homepage = await fetch(`${siteUrl}/`);
  if (isWixResponse(homepage.headers)) {
    throw new Error(
      `${siteUrl} is still on Wix. Use your *.netlify.app preview URL, not www.successmetrics.io.`,
    );
  }
  if (!homepage.ok) {
    throw new Error(
      `Cannot reach ${siteUrl} (HTTP ${homepage.status}). Check the URL and that the site is deployed.`,
    );
  }

  for (const { page, api } of [NETLIFY_FORMS.contact, NETLIFY_FORMS.jobApplication]) {
    const response = await fetch(`${siteUrl}/${page}`);
    if (!response.ok) {
      throw new Error(
        `${siteUrl}/${page} returned HTTP ${response.status}. ` +
          `Push the site/ folder and confirm netlify.toml has publish = "site".`,
      );
    }

    const html = await response.text();
    const scriptName = api === "/api/contact" ? "contact.js" : "careers.js";
    if (!html.includes(scriptName)) {
      throw new Error(
        `${page} is deployed but does not load ${scriptName}. Redeploy the latest site build.`,
      );
    }
  }
}

export function netlifyFormNotRegisteredHelp(siteUrl: string): string {
  return (
    `Netlify returned 404 for the form POST — forms are not registered yet.\n` +
    `Fix:\n` +
    `  1. Forms dashboard: ${NETLIFY_FORMS_DASHBOARD} — confirm "contact" and "job-application" appear\n` +
    `  2. If missing: Deploys → Trigger deploy → Clear cache and deploy site\n` +
    `  3. Use your *.netlify.app URL, not www.successmetrics.io (still on Wix)\n` +
    `  4. Forms are detected at deploy time from HTML with data-netlify="true"`
  );
}
