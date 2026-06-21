import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname, dirname, normalize } from "node:path";
import * as cheerio from "cheerio";
import {
  CONTENT_PAGES,
  MAIN_PAGES,
  NETLIFY_CLEAN_URLS,
  NAV_LINKS,
  SITE_DIR,
} from "./constants";

export {
  CONTENT_PAGES,
  MAIN_PAGES,
  NETLIFY_CLEAN_URLS,
  NAV_LINKS,
  SITE_DIR,
  STYLESHEET,
  LOGO,
} from "./constants";

export const ROOT = join(process.cwd(), SITE_DIR);

function findHtmlPages(dir: string, relativeDir = ""): string[] {
  const pages: string[] = [];

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

export const HTML_PAGES = findHtmlPages(ROOT);

export function readPage(filename: string): string {
  return readFileSync(join(ROOT, filename), "utf8");
}

export function loadPage(filename: string) {
  return cheerio.load(readPage(filename));
}

export function isInternalPageHref(href: string): boolean {
  if (!href || href.startsWith("#")) return false;
  if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return false;
  return true;
}

export function resolvePagePath(fromPage: string, href: string): string | null {
  const withoutHash = href.split("#")[0];
  if (!withoutHash) return null;

  if (withoutHash.startsWith("/")) {
    const rootRelative = withoutHash.replace(/^\//, "");
    if (!rootRelative || rootRelative.includes("..")) return null;
    return rootRelative;
  }

  const resolved = normalize(join(dirname(fromPage), withoutHash));
  if (resolved.startsWith("..")) return null;

  return resolved;
}

export function collectInternalLinks(filename: string): string[] {
  const $ = loadPage(filename);
  const links = new Set<string>();

  $("[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (href && isInternalPageHref(href)) {
      links.add(href);
    }
  });

  return [...links];
}

export function pageExists(fromPage: string, href: string): boolean {
  const cleanHref = href.split("#")[0]?.split("?")[0] ?? href;
  const target = resolvePagePath(fromPage, cleanHref);
  if (!target) return false;
  return existsSync(join(ROOT, target));
}

export function expectedNavHref(_fromPage: string, toPage: string): string {
  return toPage.startsWith("/") ? toPage : `/${toPage}`;
}
