import { describe, expect, it } from "vitest";
import {
  HTML_PAGES,
  MAIN_PAGES,
  NAV_LINKS,
  collectInternalLinks,
  loadPage,
  pageExists,
} from "../helpers/site";

describe("internal links", () => {
  it.each(HTML_PAGES)("%s has no broken internal page links", (page) => {
    const broken: string[] = [];

    for (const href of collectInternalLinks(page)) {
      if (!pageExists(page, href)) {
        broken.push(href);
      }
    }

    expect(broken, `Broken links on ${page}`).toEqual([]);
  });

  it.each(MAIN_PAGES)("%s includes the full primary navigation", (page) => {
    const $ = loadPage(page);

    for (const { label, href } of NAV_LINKS) {
      const link = $(`.nav-links a[href="${href}"]`);
      expect(link.length, `Missing nav link "${label}" on ${page}`).toBe(1);
      expect(link.text().trim()).toContain(label === "Talk to an Expert" ? "Talk to an Expert" : label);
    }
  });
});

describe("contact details", () => {
  it.each(MAIN_PAGES)(
    "%s shows the correct support phone and email in the footer",
    (page) => {
      const html = loadPage(page).html() ?? "";
      expect(html).toContain("(510) 330-6457");
      expect(html).toContain("support@successmetrics.io");
      expect(html).not.toContain("tel:123-456-7890");
      expect(html).not.toContain("info@mysite.com");
    },
  );

  it("contact page includes clickable phone and email links", () => {
    const $ = loadPage("contact.html");
    expect($('a[href="tel:+15103306457"]').length).toBe(1);
    expect($('a[href="mailto:support@successmetrics.io"]').length).toBe(1);
  });
});

describe("resources index", () => {
  it("links to every blog post and white paper", () => {
    const $ = loadPage("resources.html");
    const expected = [
      "content/blog-ai-enabled-delivery.html",
      "content/blog-midmarket-salesforce.html",
      "content/blog-lpi-accelerator.html",
      "content/whitepaper-midmarket-guide.html",
    ];

    for (const href of expected) {
      expect($(`a[href="${href}"]`).length).toBeGreaterThan(0);
    }
  });
});
