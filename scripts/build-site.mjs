import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { join, extname } from "node:path";

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
  "client-stories": "ACTIVE_CLIENT_STORIES",
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

const pages = findHtmlPages(SITE_DIR);
let updated = 0;

for (const page of pages) {
  if (buildPage(page)) {
    updated += 1;
  }
}

console.log(`Built navigation for ${pages.length} pages (${updated} updated).`);

const fallbackSource = join(ROOT, "data", "careers-fallback.json");
const fallbackTargetDir = join(SITE_DIR, "data");
const fallbackTarget = join(fallbackTargetDir, "careers-fallback.json");
mkdirSync(fallbackTargetDir, { recursive: true });
copyFileSync(fallbackSource, fallbackTarget);
console.log("Copied careers fallback data to site/data/careers-fallback.json");
