import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import jobsHandler from "../netlify/functions/jobs.mjs";
import jobApplicationHandler from "../netlify/functions/job-application.mjs";
import contactHandler from "../netlify/functions/contact.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SITE = join(ROOT, "site");
const PORT = Number(process.env.CAREERS_TEST_PORT || 4173);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

function loadDotEnv(path = join(ROOT, ".env")) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function sendResponse(nodeRes, webResponse) {
  nodeRes.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    nodeRes.setHeader(key, value);
  });
  const body = Buffer.from(await webResponse.arrayBuffer());
  nodeRes.end(body);
}

function toWebRequest(req, url) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const init = { method: req.method, headers };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req;
    init.duplex = "half";
  }

  return new Request(url, init);
}

function resolveStaticPath(pathname) {
  let rel = pathname.replace(/^\//, "");
  if (!rel) rel = "index.html";

  const cleanUrlMap = {
    careers: "careers.html",
    services: "services.html",
    industries: "industries.html",
    accelerators: "accelerators.html",
    resources: "resources.html",
    "ai-research": "ai-research.html",
    "success-stories": "success-stories.html",
    about: "about.html",
    contact: "contact.html",
  };

  if (cleanUrlMap[rel]) {
    rel = cleanUrlMap[rel];
  }

  let filePath = join(SITE, rel);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return filePath;
  }

  const htmlPath = join(SITE, `${rel}.html`);
  if (existsSync(htmlPath) && statSync(htmlPath).isFile()) {
    return htmlPath;
  }

  return null;
}

function serveStatic(pathname, res) {
  const filePath = resolveStaticPath(pathname);

  if (!filePath || !filePath.startsWith(SITE)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", MIME_TYPES[extname(filePath)] || "application/octet-stream");
  res.end(readFileSync(filePath));
}

loadDotEnv();

createServer(async (req, res) => {
  const host = `http://127.0.0.1:${PORT}`;
  const url = new URL(req.url || "/", host);

  try {
    if (url.pathname === "/api/jobs") {
      return sendResponse(res, await jobsHandler(toWebRequest(req, url)));
    }

    if (url.pathname === "/api/job-application") {
      return sendResponse(res, await jobApplicationHandler(toWebRequest(req, url)));
    }

    if (url.pathname === "/api/contact") {
      return sendResponse(res, await contactHandler(toWebRequest(req, url)));
    }

    serveStatic(url.pathname, res);
  } catch (error) {
    res.statusCode = 500;
    res.end(error instanceof Error ? error.message : "Server error");
  }
}).listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`careers-test-server:${PORT}\n`);
});
