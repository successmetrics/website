import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import {
  applySeoToHtml,
  generateRobotsTxt,
  generateSitemapXml,
  loadSeoConfig,
} from "./seo.mjs";

const ROOT = process.cwd();
const SITE_DIR = join(ROOT, "site");
const NAV_TEMPLATE = readFileSync(join(ROOT, "templates", "nav.html"), "utf8");

const NAV_INCLUDE =
  /<!-- @nav active="([^"]*)" -->\s*(?:<nav class="nav">[\s\S]*?<\/nav>\s*)?/;

const ACTIVE_KEYS = {
  services: "ACTIVE_SERVICES",
  industries: "ACTIVE_INDUSTRIES",
  accelerators: "ACTIVE_ACCELERATORS",
  resources: "ACTIVE_RESOURCES",
  "ai-research": "ACTIVE_AI_RESEARCH",
  "success-stories": "ACTIVE_SUCCESS_STORIES",
  careers: "ACTIVE_CAREERS",
  about: "ACTIVE_ABOUT",
};

function renderNav(active) {
  const activeClass = ' class="active"';
  let nav = NAV_TEMPLATE;

  for (const [slug, token] of Object.entries(ACTIVE_KEYS)) {
    nav = nav.replace(`{{${token}}}`, active === slug ? activeClass : "");
  }

  return nav.trimEnd();
}

function findHtmlPages(dir, relativeDir = "") {
  const pages = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relativePath = relativeDir
      ? join(relativeDir, entry.name)
      : entry.name;

    if (entry.isDirectory()) {
      pages.push(...findHtmlPages(join(dir, entry.name), relativePath));
    } else if (extname(entry.name) === ".html") {
      pages.push(relativePath);
    }
  }

  return pages;
}

const STYLESHEET_HREF =
  /href="((?:\.\.\/)*assets\/css\/styles\.css)(?:\?v=[^"]*)?"/g;

function stylesheetVersion() {
  const cssPath = join(SITE_DIR, "assets/css/styles.css");
  const css = readFileSync(cssPath);
  return createHash("sha256").update(css).digest("hex").slice(0, 12);
}

function applyStylesheetVersion(filename, version) {
  const filePath = join(SITE_DIR, filename);
  const content = readFileSync(filePath, "utf8");
  const next = content.replace(
    STYLESHEET_HREF,
    (_match, href) => `href="${href}?v=${version}"`,
  );

  if (next !== content) {
    writeFileSync(filePath, next);
    return true;
  }

  return false;
}

function buildPage(filename) {
  const filePath = join(SITE_DIR, filename);
  const content = readFileSync(filePath, "utf8");
  const match = content.match(NAV_INCLUDE);

  if (!match) {
    throw new Error(`Missing <!-- @nav active="..." --> marker in ${filename}`);
  }

  const active = match[1];
  const built = `<!-- @nav active="${active}" -->\n${renderNav(active)}\n`;
  const next = content.replace(NAV_INCLUDE, built);

  if (next === content) {
    return false;
  }

  writeFileSync(filePath, next);
  return true;
}

const seo = loadSeoConfig(ROOT);
const gaId = process.env.GOOGLE_ANALYTICS_ID?.trim() || "";

const pages = findHtmlPages(SITE_DIR);
let navUpdated = 0;
let seoUpdated = 0;

const storiesBuild = spawnSync("node", ["scripts/build-success-stories.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
});
if (storiesBuild.status !== 0) {
  process.exit(storiesBuild.status ?? 1);
}

const careersBuild = spawnSync("node", ["scripts/build-career-opportunities.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
});
if (careersBuild.status !== 0) {
  process.exit(careersBuild.status ?? 1);
}

for (const page of pages) {
  if (buildPage(page)) {
    navUpdated += 1;
  }
}

for (const page of pages) {
  if (!seo.pages[page]) continue;

  const filePath = join(SITE_DIR, page);
  const content = readFileSync(filePath, "utf8");
  const next = applySeoToHtml(content, page, seo, gaId);

  if (next !== content) {
    writeFileSync(filePath, next);
    seoUpdated += 1;
  }
}

writeFileSync(join(SITE_DIR, "robots.txt"), generateRobotsTxt(seo));
writeFileSync(join(SITE_DIR, "sitemap.xml"), generateSitemapXml(seo));

const cssVersion = stylesheetVersion();
let stylesheetUpdated = 0;

for (const page of pages) {
  if (applyStylesheetVersion(page, cssVersion)) {
    stylesheetUpdated += 1;
  }
}

console.log(
  `Built navigation for ${pages.length} pages (${navUpdated} updated).`,
);
console.log(`Applied SEO to ${seoUpdated} pages.`);
console.log(
  `Applied stylesheet cache bust v=${cssVersion} to ${stylesheetUpdated} pages.`,
);
console.log("Generated site/robots.txt and site/sitemap.xml.");
if (gaId) {
  console.log(`Google Analytics enabled (${gaId}).`);
} else {
  console.log("Google Analytics not configured (set GOOGLE_ANALYTICS_ID to enable).");
}

const fallbackSource = join(ROOT, "data", "careers-fallback.json");
const fallbackTargetDir = join(SITE_DIR, "data");
const fallbackTarget = join(fallbackTargetDir, "careers-fallback.json");
mkdirSync(fallbackTargetDir, { recursive: true });
copyFileSync(fallbackSource, fallbackTarget);
console.log("Copied careers fallback data to site/data/careers-fallback.json");

const privacyThumbSource = join(ROOT, "media", "white-papers", "privacy-thumbnail.jpg");
const privacyThumbTargetDir = join(SITE_DIR, "assets", "images", "ai-research");
const privacyThumbTarget = join(privacyThumbTargetDir, "privacy-thumbnail.jpg");
mkdirSync(privacyThumbTargetDir, { recursive: true });
if (existsSync(privacyThumbSource)) {
  copyFileSync(privacyThumbSource, privacyThumbTarget);
  console.log("Copied privacy white paper thumbnail to site/assets/images/ai-research/");
} else if (existsSync(privacyThumbTarget)) {
  console.log("Using committed privacy white paper thumbnail in site/assets/images/ai-research/");
} else {
  throw new Error(
    "Missing privacy white paper thumbnail. Add media/white-papers/privacy-thumbnail.jpg locally or commit site/assets/images/ai-research/privacy-thumbnail.jpg.",
  );
}

const orgInsightsSource = join(ROOT, "media", "videos", "OrgInishgts-New.mov");
const orgInsightsTargetDir = join(SITE_DIR, "assets", "videos");
const orgInsightsTarget = join(orgInsightsTargetDir, "orginsights.mp4");
mkdirSync(orgInsightsTargetDir, { recursive: true });

if (existsSync(orgInsightsSource)) {
  const ffmpeg = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      orgInsightsSource,
      "-c:v",
      "libx264",
      "-crf",
      "22",
      "-preset",
      "medium",
      "-g",
      "120",
      "-keyint_min",
      "120",
      "-an",
      "-movflags",
      "+faststart",
      orgInsightsTarget,
    ],
    { stdio: "inherit" },
  );
  if (ffmpeg.status !== 0) {
    process.exit(ffmpeg.status ?? 1);
  }
  console.log("Converted Org Insights demo video to site/assets/videos/orginsights.mp4");
} else if (existsSync(orgInsightsTarget)) {
  console.log("Using committed Org Insights demo video in site/assets/videos/orginsights.mp4");
} else {
  throw new Error(
    "Missing Org Insights demo video. Add media/videos/OrgInishgts-New.mov locally or commit site/assets/videos/orginsights.mp4.",
  );
}
