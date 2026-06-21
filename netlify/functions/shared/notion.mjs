import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadFallbackJobs() {
  const candidates = [
    join(process.cwd(), "data/careers-fallback.json"),
    join(moduleDir, "../../../data/careers-fallback.json"),
  ];

  for (const path of candidates) {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      /* try next path */
    }
  }

  return [];
}

const FALLBACK_JOBS = loadFallbackJobs();

export function getNotionClient() {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token) return null;
  return new Client({ auth: token });
}

export function normalizeNotionDatabaseId(value) {
  if (!value) return "";
  const trimmed = value.trim();

  const pageMatch = trimmed.match(/\/p\/([0-9a-f]{32})/i);
  if (pageMatch) {
    return formatNotionUuid(pageMatch[1]);
  }

  if (/notion/i.test(trimmed)) {
    const slugMatch = trimmed.match(/([0-9a-f]{32})(?:[?#]|$)/i);
    if (slugMatch) {
      return formatNotionUuid(slugMatch[1]);
    }
  }

  if (/^[0-9a-f]{32}$/i.test(trimmed)) {
    return formatNotionUuid(trimmed);
  }

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
  ) {
    return trimmed;
  }

  const viewMatch = trimmed.match(/[?&]v=([0-9a-f]{32})/i);
  if (viewMatch) {
    return formatNotionUuid(viewMatch[1]);
  }

  return trimmed;
}

function formatNotionUuid(hex) {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getJobsDatabaseId() {
  return normalizeNotionDatabaseId(process.env.NOTION_JOBS_DATABASE_ID);
}

export function getApplicationsDatabaseId() {
  return normalizeNotionDatabaseId(process.env.NOTION_APPLICATIONS_DATABASE_ID);
}

function richText(value) {
  return value
    ? [{ type: "text", text: { content: String(value).slice(0, 2000) } }]
    : [];
}

function readTitle(prop) {
  return prop?.title?.map((part) => part.plain_text).join("") || "";
}

function readRichText(prop) {
  return prop?.rich_text?.map((part) => part.plain_text).join("") || "";
}

function readSelect(prop) {
  return prop?.select?.name || "";
}

function readNumber(prop) {
  return typeof prop?.number === "number" ? prop.number : 0;
}

export function parseJobPage(page) {
  const props = page.properties || {};
  const titleProp =
    props.Title || props.Name || props["Job Title"] || props.title;
  const idProp = props["Job ID"] || props.ID || props["Job ID"];
  const locationProp = props.Location || props.location;
  const typeProp =
    props["Employment Type"] || props.Type || props["Job Type"] || props.type;
  const statusProp = props.Status || props.status;

  const title = readTitle(titleProp) || readRichText(titleProp);
  const id = readRichText(idProp) || readTitle(idProp);
  const location = readRichText(locationProp);
  const type = readSelect(typeProp) || readRichText(typeProp) || "Full-time";
  const status = readSelect(statusProp) || "Open";
  const sortOrder = readNumber(props["Sort Order"] || props.Order || props.order);

  return { id, title, location, type, status, sortOrder, notionId: page.id };
}

export function isOpenJob(job) {
  return job.title && job.id && job.status.toLowerCase() === "open";
}

export function toPublicJob(job) {
  return {
    id: job.id,
    title: job.title,
    location: job.location,
    type: job.type,
    label: `${job.title} (${job.id})`,
  };
}

export async function fetchOpenJobs() {
  const notion = getNotionClient();
  const databaseId = getJobsDatabaseId();

  if (!notion || !databaseId) {
    return { jobs: FALLBACK_JOBS.map(toPublicJob), source: "fallback" };
  }

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [{ property: "Sort Order", direction: "ascending" }],
    });

    const jobs = response.results
      .map(parseJobPage)
      .filter(isOpenJob)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toPublicJob);

    return { jobs, source: "notion" };
  } catch (error) {
    console.error("Notion jobs query failed:", error);
    return { jobs: FALLBACK_JOBS.map(toPublicJob), source: "fallback" };
  }
}

export async function uploadFileToNotion(file) {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token || !file) return null;

  const notionVersion = "2025-09-03";
  const createResponse = await fetch("https://api.notion.com/v1/file_uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": notionVersion,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "single_part",
      filename: file.name,
      content_type: file.type || "application/octet-stream",
    }),
  });

  if (!createResponse.ok) {
    const body = await createResponse.text();
    throw new Error(`Notion file upload create failed (${createResponse.status}): ${body}`);
  }

  const uploadMeta = await createResponse.json();
  const bytes = Buffer.from(await file.arrayBuffer());
  const form = new FormData();
  const blob = new Blob([bytes], { type: file.type || "application/octet-stream" });
  form.append("file", blob, file.name);

  const sendUrl =
    uploadMeta.upload_url ||
    `https://api.notion.com/v1/file_uploads/${uploadMeta.id}/send`;

  const sendResponse = await fetch(sendUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": notionVersion,
    },
    body: form,
  });

  if (!sendResponse.ok) {
    const body = await sendResponse.text();
    throw new Error(`Notion file upload send failed (${sendResponse.status}): ${body}`);
  }

  const uploaded = await sendResponse.json();
  if (uploaded.status && uploaded.status !== "uploaded") {
    throw new Error(`Notion file upload did not complete (status: ${uploaded.status})`);
  }

  return uploadMeta.id;
}

export async function createApplicationPage({
  name,
  email,
  phone,
  position,
  linkedin,
  message,
  resumeFile,
}) {
  const notion = getNotionClient();
  const databaseId = getApplicationsDatabaseId();
  if (!notion || !databaseId) {
    throw new Error("Notion applications database is not configured");
  }

  let resumeUploadId = null;
  if (resumeFile && resumeFile.size > 0) {
    try {
      resumeUploadId = await uploadFileToNotion(resumeFile);
    } catch (error) {
      console.error("Resume upload to Notion failed:", error);
    }
  }

  const properties = {
    Applicant: { title: richText(name) },
    Email: { email },
    Phone: { rich_text: richText(phone) },
    Position: { rich_text: richText(position) },
    Message: { rich_text: richText(message) },
    Submitted: { date: { start: new Date().toISOString().slice(0, 10) } },
    Status: { select: { name: "New" } },
  };

  if (linkedin) {
    properties.LinkedIn = { url: linkedin };
  }

  if (resumeUploadId) {
    properties.Resume = {
      files: [
        {
          type: "file_upload",
          file_upload: { id: resumeUploadId },
          name: resumeFile.name,
        },
      ],
    };
  }

  return notion.pages.create({
    parent: { database_id: databaseId },
    properties,
  });
}

export function readApplicationPage(page) {
  const props = page.properties || {};

  return {
    id: page.id,
    name: readTitle(props.Applicant),
    email: props.Email?.email || "",
    phone: readRichText(props.Phone),
    position: readRichText(props.Position),
    message: readRichText(props.Message),
    status: readSelect(props.Status),
    hasResume: Boolean(props.Resume?.files?.length),
  };
}

export async function findApplicationsByEmail(email) {
  const notion = getNotionClient();
  const databaseId = getApplicationsDatabaseId();
  if (!notion || !databaseId || !email) return [];

  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: "Email",
      email: { equals: email },
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });

  return response.results;
}
