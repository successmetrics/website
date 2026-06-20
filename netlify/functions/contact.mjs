import { sendContactNotification } from "./shared/email.mjs";

const headers = {
  "Content-Type": "application/json",
};

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let fields;

    if (contentType.includes("application/json")) {
      fields = await request.json();
    } else {
      const formData = await request.formData();
      fields = Object.fromEntries(formData.entries());
    }

    if (fields["bot-field"]) {
      return json({ ok: true, ignored: true }, 200);
    }

    const name = requiredText(fields.name, "Name");
    const email = requiredText(fields.email, "Email");
    const company = requiredText(fields.company, "Company / Agency");
    const message = requiredText(fields.message, "Message");
    const phone = optionalText(fields.phone);
    const interest = optionalText(fields.interest);

    validateEmail(email);

    const emailResult = await sendContactNotification({
      name,
      email,
      phone,
      company,
      interest,
      message,
    });

    if (!emailResult.sent) {
      return json(
        {
          error:
            "We could not send your message. Please email support@successmetrics.io directly.",
          reason: emailResult.reason,
        },
        503,
      );
    }

    return json({ ok: true, emailSent: true, id: emailResult.id }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid submission";
    const status =
      message.includes("required") || message.includes("invalid") ? 400 : 500;
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

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers });
}
