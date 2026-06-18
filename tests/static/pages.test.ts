import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONTENT_PAGES,
  HTML_PAGES,
  MAIN_PAGES,
  NETLIFY_CLEAN_URLS,
  LOGO,
  STYLESHEET,
  ROOT,
  loadPage,
} from "../helpers/site";

describe("site pages", () => {
  it("includes every expected HTML page", () => {
    const expected = [...MAIN_PAGES, ...CONTENT_PAGES];
    expect(HTML_PAGES.sort()).toEqual([...expected].sort());
  });

  it.each(HTML_PAGES)("%s has required document structure", (page) => {
    const html = readFileSync(join(ROOT, page), "utf8");
    const $ = loadPage(page);

    expect(html.trimStart().startsWith("<!DOCTYPE html>")).toBe(true);
    expect($("html").attr("lang")).toBe("en");
    expect($("title").text().trim().length).toBeGreaterThan(0);
    expect($('meta[name="description"]').attr("content")?.trim().length).toBeGreaterThan(0);
    expect($('link[rel="stylesheet"][href*="assets/css/styles.css"]').length).toBe(1);
    expect($('link[rel="icon"][href*="assets/images/logo.svg"]').length).toBe(1);
    expect($("nav.nav").length).toBe(1);
    expect($("footer").length).toBe(1);
    expect($("h1").length).toBeGreaterThan(0);
  });

  it.each(Object.entries(NETLIFY_CLEAN_URLS))(
    "netlify clean URL %s maps to an existing page (%s)",
    (_path, htmlFile) => {
      expect(existsSync(join(ROOT, htmlFile))).toBe(true);
    },
  );
});

describe("shared assets", () => {
  it("styles.css defines core design tokens", () => {
    const css = readFileSync(join(ROOT, STYLESHEET), "utf8");

    expect(css).toContain("--bg:");
    expect(css).toContain("--card:");
    expect(css).toContain("--gradient:");
    expect(css).toContain("--font:");
  });

  it("logo.svg exists and is valid SVG", () => {
    const logo = readFileSync(join(ROOT, LOGO), "utf8");
    expect(logo).toContain("<svg");
  });
});
