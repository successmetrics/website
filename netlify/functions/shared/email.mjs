import { Resend } from "resend";

export async function sendApplicationNotification({
  name,
  email,
  phone,
  position,
  linkedin,
  message,
  resumeFile,
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const notifyEmail = process.env.CAREERS_NOTIFY_EMAIL?.trim() || "careers@successmetrics.io";
  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() || "SuccessMetrics Careers <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set — skipping careers notification email");
    return { sent: false, reason: "missing_api_key" };
  }

  const resend = new Resend(apiKey);
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
