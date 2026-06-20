import { Resend } from "resend";

const VERIFIED_FROM_EMAIL =
  "SuccessMetrics <sduraisamy@successmetrics.io>";
const DEFAULT_NOTIFY_EMAIL = "aditya@successmetrics.io";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromEmail(kind = "careers") {
  if (kind === "contact") {
    return (
      process.env.RESEND_CONTACT_FROM_EMAIL?.trim() ||
      process.env.RESEND_FROM_EMAIL?.trim() ||
      VERIFIED_FROM_EMAIL
    );
  }

  return process.env.RESEND_FROM_EMAIL?.trim() || VERIFIED_FROM_EMAIL;
}

function getNotifyEmail(kind = "careers") {
  if (kind === "contact") {
    return (
      process.env.CONTACT_NOTIFY_EMAIL?.trim() ||
      process.env.CAREERS_NOTIFY_EMAIL?.trim() ||
      DEFAULT_NOTIFY_EMAIL
    );
  }

  return process.env.CAREERS_NOTIFY_EMAIL?.trim() || DEFAULT_NOTIFY_EMAIL;
}

export async function sendContactNotification({
  name,
  email,
  phone,
  company,
  interest,
  message,
}) {
  const resend = getResendClient();
  const notifyEmail = getNotifyEmail("contact");
  const fromEmail = getFromEmail("contact");

  if (!resend) {
    console.warn("RESEND_API_KEY is not set — skipping contact notification email");
    return { sent: false, reason: "missing_api_key" };
  }

  const submittedAt = new Date().toISOString();
  const html = `
    <h2>New contact form submission</h2>
    <p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone || "—")}</p>
    <p><strong>Company / Agency:</strong> ${escapeHtml(company)}</p>
    <p><strong>Interest:</strong> ${escapeHtml(interest || "—")}</p>
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(message)}</pre>
  `;

  const result = await resend.emails.send({
    from: fromEmail,
    to: [notifyEmail],
    replyTo: email,
    subject: `New contact inquiry: ${interest || "General"} — ${name}`,
    html,
  });

  if (result.error) {
    throw new Error(result.error.message || "Resend email failed");
  }

  return { sent: true, id: result.data?.id };
}

export async function sendApplicationNotification({
  name,
  email,
  phone,
  position,
  linkedin,
  message,
  resumeFile,
}) {
  const resend = getResendClient();
  const notifyEmail = getNotifyEmail("careers");
  const fromEmail = getFromEmail("careers");

  if (!resend) {
    console.warn("RESEND_API_KEY is not set — skipping careers notification email");
    return { sent: false, reason: "missing_api_key" };
  }

  const submittedAt = new Date().toISOString();
  const html = `
    <h2>New careers application</h2>
    <p><strong>Submitted:</strong> ${submittedAt}</p>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone || "—")}</p>
    <p><strong>Position:</strong> ${escapeHtml(position)}</p>
    <p><strong>LinkedIn:</strong> ${linkedin ? `<a href="${escapeHtml(linkedin)}">${escapeHtml(linkedin)}</a>` : "—"}</p>
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(message)}</pre>
  `;

  const attachments = [];
  if (resumeFile && resumeFile.size > 0) {
    attachments.push({
      filename: resumeFile.name || "resume.pdf",
      content: Buffer.from(await resumeFile.arrayBuffer()),
    });
  }

  const result = await resend.emails.send({
    from: fromEmail,
    to: [notifyEmail],
    replyTo: email,
    subject: `New application: ${position} — ${name}`,
    html,
    attachments,
  });

  if (result.error) {
    throw new Error(result.error.message || "Resend email failed");
  }

  return { sent: true, id: result.data?.id };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
