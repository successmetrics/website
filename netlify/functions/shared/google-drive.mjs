import { createSign } from "node:crypto";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink";

function getServiceAccount() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.client_email && parsed.private_key) {
        return {
          email: String(parsed.client_email).trim(),
          privateKey: String(parsed.private_key).replace(/\\n/g, "\n"),
        };
      }
    } catch (error) {
      console.warn("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON:", error);
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()?.replace(
    /\\n/g,
    "\n",
  );

  if (email && privateKey) {
    return { email, privateKey };
  }

  return null;
}

function getFolderId() {
  return process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || "";
}

export function hasGoogleDriveConfig() {
  return Boolean(getServiceAccount() && getFolderId());
}

function base64Url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer.toString("base64url");
}

function createServiceAccountJwt(email, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64Url(signer.sign(privateKey));
  return `${unsigned}.${signature}`;
}

async function getAccessToken(account) {
  const assertion = createServiceAccountJwt(account.email, account.privateKey);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || "Google OAuth token request failed",
    );
  }

  return payload.access_token;
}

function sanitizeFilename(name) {
  return String(name || "resume.pdf")
    .replace(/[^\w.\-()+ ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function buildDriveFilename({ name, position, resumeFile }) {
  const stamp = new Date().toISOString().slice(0, 10);
  const applicant = sanitizeFilename(name || "applicant").replace(/\s+/g, "-");
  const role = sanitizeFilename(position || "role").replace(/\s+/g, "-");
  const original = sanitizeFilename(resumeFile?.name || "resume.pdf");
  return `${stamp}_${applicant}_${role}_${original}`;
}

/**
 * Upload a resume File/Blob into the configured shared Drive folder.
 * Returns { uploaded: false, reason } when Drive is not configured.
 */
export async function uploadResumeToDrive({ name, position, resumeFile }) {
  const account = getServiceAccount();
  const folderId = getFolderId();

  if (!account || !folderId) {
    console.warn("Google Drive is not configured — skipping resume upload");
    return { uploaded: false, reason: "missing_drive_config" };
  }

  if (!resumeFile || resumeFile.size <= 0) {
    return { uploaded: false, reason: "missing_resume" };
  }

  const accessToken = await getAccessToken(account);
  const bytes = Buffer.from(await resumeFile.arrayBuffer());
  const filename = buildDriveFilename({ name, position, resumeFile });
  const mimeType = resumeFile.type || "application/octet-stream";
  const metadata = {
    name: filename,
    parents: [folderId],
  };

  const boundary = `sm_boundary_${Date.now()}`;
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([preamble, bytes, epilogue]);

  const response = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `Google Drive upload failed (${response.status})`,
    );
  }

  return {
    uploaded: true,
    id: payload.id,
    name: payload.name,
    webViewLink: payload.webViewLink,
  };
}
