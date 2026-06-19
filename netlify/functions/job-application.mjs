import { createApplicationPage } from "./shared/notion.mjs";
import { sendApplicationNotification } from "./shared/email.mjs";

const MAX_RESUME_BYTES = 8 * 1024 * 1024;
const ALLOWED_RESUME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const headers = {
  "Content-Type": "application/json",
};

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const formData = await request.formData();

    if (formData.get("bot-field")) {
      return json({ ok: true, ignored: true }, 200);
    }

    const name = requiredText(formData.get("name"), "Name");
    const email = requiredText(formData.get("email"), "Email");
    const position = requiredText(formData.get("position"), "Position");
    const message = requiredText(formData.get("message"), "Message");
    const phone = optionalText(formData.get("phone"));
    const linkedin = optionalText(formData.get("linkedin"));
    const resumeFile = formData.get("resume");

    validateEmail(email);
    validateResume(resumeFile);

    const application = {
      name,
      email,
      phone,
      position,
      linkedin,
      message,
      resumeFile,
    };

    const [notionPage, emailResult] = await Promise.allSettled([
      createApplicationPage(application),
      sendApplicationNotification(application),
    ]);

    if (notionPage.status === "rejected") {
      console.error("Notion application create failed:", notionPage.reason);
      return json(
        {
          error:
            "We could not save your application. Please email careers@successmetrics.io directly.",
        },
        502,
      );
    }

    if (emailResult.status === "rejected") {
      console.error("Careers notification email failed:", emailResult.reason);
    }

    return json(
      {
        ok: true,
        notionPageId: notionPage.value.id,
        emailSent: emailResult.status === "fulfilled" && emailResult.value.sent,
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid submission";
    const status = message.includes("required") || message.includes("Resume") ? 400 : 500;
    return json({ error: message }, status);
  }
}

function requiredText(value, label) {
  const text = optionalText(value);
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function optionalText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email is invalid");
  }
}

function validateResume(file) {
  if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
    throw new Error("Resume is required");
  }

  if (file.size <= 0) {
    throw new Error("Resume is required");
  }

  if (file.size > MAX_RESUME_BYTES) {
    throw new Error("Resume must be 8 MB or smaller");
  }

  const type = file.type || "";
  const name = (file.name || "").toLowerCase();
  const allowedByExtension =
    name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx");

  if (type && !ALLOWED_RESUME_TYPES.has(type) && !allowedByExtension) {
    throw new Error("Resume must be a PDF or Word document");
  }
}

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers });
}
