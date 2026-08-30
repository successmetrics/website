import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONTENT_PAGES,
  HTML_PAGES,
  MAIN_PAGES,
  OG_DEFAULT_IMAGE,
  ROOT,
  loadPage,
} from "../helpers/site";

const SEO_CONFIG = JSON.parse(
  readFileSync(join(process.cwd(), "data", "seo.json"), "utf8"),
);

const ALL_SEO_PAGES = [...MAIN_PAGES, ...CONTENT_PAGES];

describe("SEO config", () => {
  it("defines metadata for every HTML page", () => {
    for (const page of HTML_PAGES) {
      expect(SEO_CONFIG.pages[page], `missing SEO entry for ${page}`).toBeDefined();
    }
  });

  it("keeps titles within 60 characters", () => {
    for (const page of ALL_SEO_PAGES) {
      const title = SEO_CONFIG.pages[page].title;
      expect(title.length, `${page} title too long`).toBeLessThanOrEqual(60);
    }
  });

  it("keeps meta descriptions between 50 and 160 characters", () => {
    for (const page of ALL_SEO_PAGES) {
      const description = SEO_CONFIG.pages[page].description;
      expect(description.length, `${page} description too short`).toBeGreaterThanOrEqual(50);
      expect(description.length, `${page} description too long`).toBeLessThanOrEqual(160);
    }
  });
});

describe("page SEO tags", () => {
  it.each(ALL_SEO_PAGES)("%s has active SEO head tags", (page) => {
    const html = readFileSync(join(ROOT, page), "utf8");
    const $ = loadPage(page);
    const config = SEO_CONFIG.pages[page];
    const canonical = `${SEO_CONFIG.siteOrigin}${config.path}`;

    expect(html).toContain("<!-- seo:start -->");
    expect(html).toContain("<!-- seo:end -->");
    expect($("title").text().trim()).toBe(config.title);
    expect($('meta[name="description"]').attr("content")?.trim()).toBe(config.description);
    expect($('link[rel="canonical"]').attr("href")).toBe(canonical);
    expect($('meta[name="robots"]').attr("content")).toBe("index, follow");

    expect($('meta[property="og:title"]').attr("content")).toBe(config.title);
    expect($('meta[property="og:description"]').attr("content")).toBe(config.description);
    expect($('meta[property="og:url"]').attr("content")).toBe(canonical);
    expect($('meta[property="og:site_name"]').attr("content")).toBe("SuccessMetrics");
    const ogImage = `${SEO_CONFIG.siteOrigin}${config.ogImage || SEO_CONFIG.defaultOgImage}`;
    expect($('meta[property="og:image"]').attr("content")).toBe(ogImage);
    if (!config.ogImage) {
      expect($('meta[property="og:image:type"]').attr("content")).toBe("image/png");
      expect($('meta[property="og:image:width"]').attr("content")).toBe("1200");
      expect($('meta[property="og:image:height"]').attr("content")).toBe("630");
    }

    expect($('meta[name="twitter:card"]').attr("content")).toBe("summary_large_image");
    expect($('meta[name="twitter:title"]').attr("content")).toBe(config.title);
    expect($('meta[name="twitter:description"]').attr("content")).toBe(config.description);

    expect($('script[type="application/ld+json"]').length).toBeGreaterThan(0);
  });
});

describe("default Open Graph image", () => {
  it("ships a 1200x630 PNG at the configured defaultOgImage path", () => {
    expect(SEO_CONFIG.defaultOgImage).toBe(`/${OG_DEFAULT_IMAGE}`);
    const file = join(ROOT, OG_DEFAULT_IMAGE);
    expect(existsSync(file), `missing ${OG_DEFAULT_IMAGE}`).toBe(true);

    const png = readFileSync(file);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

describe("site-wide SEO files", () => {
  it("generates robots.txt with sitemap reference", () => {
    const robots = readFileSync(join(ROOT, "robots.txt"), "utf8");
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /demo/");
    expect(robots).toContain(`Sitemap: ${SEO_CONFIG.siteOrigin}/sitemap.xml`);
  });

  it("generates sitemap.xml with all canonical URLs", () => {
    const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain("<urlset");

    for (const page of ALL_SEO_PAGES) {
      const path = SEO_CONFIG.pages[page].path;
      expect(sitemap, `missing ${path} in sitemap`).toContain(
        `<loc>${SEO_CONFIG.siteOrigin}${path}</loc>`,
      );
    }
  });

  it("does not list .html URLs in sitemap", () => {
    const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
    expect(sitemap).not.toMatch(/\.html<\/loc>/);
  });
});

describe("Google Analytics hook", () => {
  it("leaves analytics disabled when GOOGLE_ANALYTICS_ID is unset", () => {
    for (const page of ALL_SEO_PAGES) {
      const html = readFileSync(join(ROOT, page), "utf8");
      expect(html).not.toContain("googletagmanager.com/gtag/js");
    }
  });
});
