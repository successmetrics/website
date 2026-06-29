import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HTML_PAGES,
  MAIN_PAGES,
  NETLIFY_CLEAN_URLS,
  ROOT,
  loadPage,
  readPage,
} from "../helpers/site";
import { readNetlifyToml } from "../helpers/netlify";

const SEO_CONFIG = JSON.parse(
  readFileSync(join(process.cwd(), "data", "seo.json"), "utf8"),
);

const SUCCESS_STORY_PAGES = [
  "content/success-stories/amp-customer-portal-success-story.html",
  "content/success-stories/caloes-ppe-portal-success-story.html",
  "content/success-stories/leaflink-cpq-success-story.html",
  "content/success-stories/sfhss-agentforce-success-story.html",
  "content/success-stories/mohcd-agentforce-success-story.html",
] as const;

const SUCCESS_STORY_SLUGS = [
  "amp-customer-portal-success-story",
  "caloes-ppe-portal-success-story",
  "leaflink-cpq-success-story",
  "sfhss-agentforce-success-story",
  "mohcd-agentforce-success-story",
] as const;

const netlifyToml = readNetlifyToml();

describe("success stories site structure", () => {
  it("uses success-stories.html as the index page", () => {
    expect(existsSync(join(ROOT, "success-stories.html"))).toBe(true);
    expect(existsSync(join(ROOT, "client-stories.html"))).toBe(false);
  });

  it("stores markdown and HTML under content/success-stories/", () => {
    expect(existsSync(join(ROOT, "content/success-stories"))).toBe(true);
    expect(existsSync(join(ROOT, "content/client-stories"))).toBe(false);

    for (const slug of SUCCESS_STORY_SLUGS) {
      expect(existsSync(join(ROOT, "content/success-stories", `${slug}.md`))).toBe(true);
      expect(existsSync(join(ROOT, "content/success-stories", `${slug}.html`))).toBe(true);
    }
  });

  it("nav template links to Success Stories with the correct build token", () => {
    const nav = readFileSync(join(process.cwd(), "templates", "nav.html"), "utf8");

    expect(nav).toContain('href="/success-stories.html"{{ACTIVE_SUCCESS_STORIES}}>Success Stories');
    expect(nav).not.toContain("Client Stories");
    expect(nav).not.toContain("client-stories");
    expect(nav).not.toContain("ACTIVE_CLIENT_STORIES");
  });

  it("build pipeline targets success-stories paths", () => {
    const buildSite = readFileSync(join(process.cwd(), "scripts", "build-site.mjs"), "utf8");
    const buildStories = readFileSync(
      join(process.cwd(), "scripts", "build-success-stories.mjs"),
      "utf8",
    );

    expect(buildSite).toContain("build-success-stories.mjs");
    expect(buildSite).toContain('"success-stories": "ACTIVE_SUCCESS_STORIES"');
    expect(buildStories).toContain("success-stories.html");
    expect(buildStories).toContain("content/success-stories");
    expect(buildStories).not.toContain("client-stories");
  });
});

describe("success stories URLs in rendered pages", () => {
  it.each(HTML_PAGES)("%s does not reference legacy client-stories paths", (page) => {
    const html = readPage(page);

    expect(html, `${page} still links to client-stories.html`).not.toContain("client-stories.html");
    expect(html, `${page} still links to content/client-stories/`).not.toContain(
      "content/client-stories/",
    );
    expect(html, `${page} still shows Client Stories label`).not.toContain("Client Stories");
  });

  it.each(MAIN_PAGES)("%s footer links to success-stories.html", (page) => {
    const $ = loadPage(page);
    expect($('footer a[href="success-stories.html"]').length).toBeGreaterThan(0);
  });

  it("success stories index uses the success-stories nav marker", () => {
    expect(readPage("success-stories.html")).toContain('<!-- @nav active="success-stories" -->');
  });

  it.each(SUCCESS_STORY_PAGES)("%s uses the success-stories nav marker", (page) => {
    expect(readPage(page)).toContain('<!-- @nav active="success-stories" -->');
  });
});

describe("success stories navigation bar", () => {
  it.each(HTML_PAGES)("%s includes Success Stories in the primary nav", (page) => {
    const $ = loadPage(page);
    const link = $('.nav-links a[href="/success-stories.html"]');

    expect(link.length, `Missing Success Stories nav on ${page}`).toBe(1);
    expect(link.text().trim()).toBe("Success Stories");
  });

  it.each(
    HTML_PAGES.filter(
      (page) =>
        page !== "success-stories.html" &&
        !(SUCCESS_STORY_PAGES as readonly string[]).includes(page),
    ),
  )("%s does not mark Success Stories as active", (page) => {
    const $ = loadPage(page);
    const link = $('.nav-links a[href="/success-stories.html"]');
    expect(link.hasClass("active"), `${page} should not mark Success Stories active`).toBe(false);
  });

  it.each(["success-stories.html", ...SUCCESS_STORY_PAGES])(
    "%s marks Success Stories as the active nav item",
    (page) => {
      const $ = loadPage(page);
      const link = $('.nav-links a[href="/success-stories.html"]');
      expect(link.hasClass("active"), `${page} should mark Success Stories active`).toBe(true);
    },
  );

  it("success stories index links to every story with content/success-stories/ paths", () => {
    const $ = loadPage("success-stories.html");

    for (const page of SUCCESS_STORY_PAGES) {
      expect($(`a[href="${page}"]`).length).toBeGreaterThan(0);
    }
  });

  it.each(SUCCESS_STORY_PAGES)("%s links back to the success stories index", (page) => {
    const $ = loadPage(page);
    const backLink = $('a[href="../../success-stories.html"]');

    expect(backLink.length).toBe(1);
    expect(backLink.text().trim()).toBe("← Back to Success Stories");
  });
});

describe("success stories SEO and sitemap", () => {
  it("seo.json defines success-stories URLs, not legacy client-stories keys", () => {
    expect(SEO_CONFIG.pages["success-stories.html"]).toBeDefined();
    expect(SEO_CONFIG.pages["client-stories.html"]).toBeUndefined();

    for (const page of SUCCESS_STORY_PAGES) {
      expect(SEO_CONFIG.pages[page]).toBeDefined();
      expect(SEO_CONFIG.pages[page].path).toContain("/content/success-stories/");
      expect(SEO_CONFIG.pages[page].path).not.toContain("client-stories");
    }

    expect(SEO_CONFIG.sitemap["success-stories.html"]).toBeDefined();
    expect(SEO_CONFIG.sitemap["client-stories.html"]).toBeUndefined();
  });

  it("success stories index has correct canonical and page title", () => {
    const $ = loadPage("success-stories.html");
    const config = SEO_CONFIG.pages["success-stories.html"];

    expect($("title").text().trim()).toBe(config.title);
    expect(config.title).toContain("Success Stories");
    expect(config.title).not.toContain("Client Stories");
    expect($('link[rel="canonical"]').attr("href")).toBe(
      `${SEO_CONFIG.siteOrigin}/success-stories`,
    );
    expect($(".page-hero .kicker").text().trim()).toBe("Success Stories");
  });

  it("sitemap lists success-stories URLs and omits client-stories", () => {
    const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");

    expect(sitemap).toContain("<loc>https://www.successmetrics.io/success-stories</loc>");
    expect(sitemap).toContain(
      "<loc>https://www.successmetrics.io/content/success-stories/sfhss-agentforce-success-story</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://www.successmetrics.io/content/success-stories/mohcd-agentforce-success-story</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://www.successmetrics.io/content/success-stories/amp-customer-portal-success-story</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://www.successmetrics.io/content/success-stories/caloes-ppe-portal-success-story</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://www.successmetrics.io/content/success-stories/leaflink-cpq-success-story</loc>",
    );
    expect(sitemap).not.toContain("client-stories");
  });
});

describe("netlify success stories routing", () => {
  it.skipIf(netlifyToml === null)("maps /success-stories clean URL to success-stories.html", () => {
    expect(netlifyToml).toContain('from = "/success-stories"');
    expect(netlifyToml).toContain('to = "/success-stories.html"');
    expect(NETLIFY_CLEAN_URLS["/success-stories"]).toBe("success-stories.html");
  });

  it.skipIf(netlifyToml === null)("redirects legacy client-stories URLs to success-stories", () => {
    expect(netlifyToml).toContain('from = "/client-stories"');
    expect(netlifyToml).toContain('to = "/success-stories"');
    expect(netlifyToml).toMatch(/from = "\/client-stories"[\s\S]*?status = 301/);

    expect(netlifyToml).toContain('from = "/client-stories.html"');
    expect(netlifyToml).toContain('to = "/success-stories.html"');

    expect(netlifyToml).toContain(
      'from = "/content/client-stories/sfhss-agentforce-success-story"',
    );
    expect(netlifyToml).toContain(
      'to = "/content/success-stories/sfhss-agentforce-success-story"',
    );
  });

  it.skipIf(netlifyToml === null)("maps success story content clean URLs", () => {
    for (const slug of SUCCESS_STORY_SLUGS) {
      expect(netlifyToml).toContain(`from = "/content/success-stories/${slug}"`);
      expect(netlifyToml).toContain(`to = "/content/success-stories/${slug}.html"`);
    }
  });
});
