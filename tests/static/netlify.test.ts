import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPage } from "../helpers/site";
import { NETLIFY_FORMS, readNetlifyToml } from "../helpers/netlify";
import { loadCareerJobPages } from "../helpers/careers.mjs";

const netlifyToml = readNetlifyToml();
const careerJobs = loadCareerJobPages();

function expectCareerDetailApplyForm($: ReturnType<typeof loadPage>, job: (typeof careerJobs)[number]) {
  const form = $("#job-application-form");

  expect(form.length).toBe(1);
  expect(form.attr("method")?.toUpperCase()).toBe("POST");
  expect(form.attr("enctype")).toBe("multipart/form-data");
  expect(form.attr("data-netlify")).toBeUndefined();
  expect(form.find('input[name="bot-field"]').length).toBe(1);
  expect($("body.careers-detail-page").length).toBe(1);
  expect($("body").attr("data-preselected-role")).toBe(job.label);
  expect($(".job-detail-layout").length).toBe(1);
  expect($(".job-detail-content .job-section").length).toBeGreaterThan(0);
  expect($("#apply").length).toBe(1);
  expect($('script[src="../assets/js/careers.js"]').length).toBe(1);

  for (const field of ["name", "email", "position", "message", "resume"]) {
    expect(form.find(`[name="${field}"]`).length).toBeGreaterThan(0);
  }
}

describe("netlify.toml", () => {
  it.skipIf(netlifyToml === null)("exposes health, careers, and contact API routes", () => {
    expect(netlifyToml).toContain('from = "/api/jobs"');
    expect(netlifyToml).toContain('from = "/api/job-application"');
    expect(netlifyToml).toContain('from = "/api/contact"');
    expect(netlifyToml).toContain('from = "/api/health"');
  });

  it.skipIf(netlifyToml === null)("runs the site build before publish", () => {
    expect(netlifyToml).toMatch(/command\s*=\s*"npm run build"/);
  });

  it.skipIf(netlifyToml === null)("sets site/ as the publish directory", () => {
    expect(netlifyToml).toMatch(/publish\s*=\s*"site"/);
  });

  it.skipIf(netlifyToml === null)("defines clean URLs for main pages", () => {
    for (const slug of ["careers", "services", "contact", "ai-research", "success-stories"]) {
      expect(netlifyToml).toContain(`from = "/${slug}"`);
      expect(netlifyToml).toContain(`to = "/${slug}.html"`);
    }
  });

  it.skipIf(netlifyToml === null)("maps career opportunity subpages under /careers/:slug", () => {
    expect(netlifyToml).toContain('from = "/careers/:slug"');
    expect(netlifyToml).toContain('to = "/careers/:slug.html"');

    for (const job of careerJobs) {
      expect(netlifyToml).not.toContain(`from = "${job.path}"`);
    }
  });

  it.skipIf(netlifyToml === null)("caches versioned static assets", () => {
    expect(netlifyToml).toContain('for = "/assets/css/*"');
    expect(netlifyToml).toContain('for = "/assets/js/*"');
  });
});

describe("careers data and listing structure", () => {
  it("ships careers fallback data without the accessibility specialist role", () => {
    const fallback = JSON.parse(
      readFileSync(join(process.cwd(), "data/careers-fallback.json"), "utf8"),
    );

    expect(fallback).toHaveLength(3);
    expect(fallback.map((job: { id: string }) => job.id)).toEqual([
      "JD-0084",
      "JD-0082",
      "JD-0081",
    ]);
    expect(
      fallback.some((job: { title: string }) => /accessibility specialist/i.test(job.title)),
    ).toBe(false);
  });

  it("ships a careers job index for detail page links", () => {
    const indexPath = join(process.cwd(), "site/data/careers-job-index.json");
    expect(existsSync(indexPath)).toBe(true);

    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    expect(Object.keys(index)).toEqual(["JD-0084", "JD-0082", "JD-0081"]);
    expect(index["JD-0081"].detailUrl).toBe("/careers/salesforce-developer-0081");
  });

  it("careers index page exposes the dynamic job board and apply section", () => {
    const $ = loadPage("careers.html");

    expect($("#openings").length).toBe(1);
    expect($("#job-list").length).toBe(1);
    expect($("#apply").length).toBe(1);
    expect($("#job-application-form").length).toBe(1);
    expect($('script[src="assets/js/careers.js"]').length).toBe(1);
  });
});

describe("form markup", () => {
  it("contact form uses the API handler instead of Netlify Forms", () => {
    const $ = loadPage("contact.html");
    const form = $("#contact-form");

    expect(form.length).toBe(1);
    expect(form.attr("method")?.toUpperCase()).toBe("POST");
    expect(form.attr("data-netlify")).toBeUndefined();
    expect(form.find('input[name="bot-field"]').length).toBe(1);
    expect(form.attr("enctype")).toBeUndefined();
    expect($('script[src="assets/js/contact.js"]').length).toBe(1);
  });

  it("careers application form uses the API handler instead of Netlify Forms", () => {
    const $ = loadPage("careers.html");
    const form = $("#job-application-form");

    expect(form.length).toBe(1);
    expect(form.attr("data-netlify")).toBeUndefined();
    expect(form.attr("enctype")).toBe("multipart/form-data");
    expect(form.find('input[name="bot-field"]').length).toBe(1);
  });

  it("neither main form registers Netlify Forms anymore", () => {
    const contact = loadPage("contact.html")('form[data-netlify="true"]');
    const careers = loadPage("careers.html")('form[data-netlify="true"]');

    expect(contact.length).toBe(0);
    expect(careers.length).toBe(0);
  });

  it("contact form exposes all expected submission fields", () => {
    const form = loadPage("contact.html")("#contact-form");

    for (const field of NETLIFY_FORMS.contact.fields) {
      expect(form.find(`[name="${field}"]`).length).toBeGreaterThan(0);
    }
  });

  it("careers index form exposes all expected submission fields including resume upload", () => {
    const form = loadPage("careers.html")("#job-application-form");

    for (const field of NETLIFY_FORMS.jobApplication.fields) {
      expect(form.find(`[name="${field}"]`).length).toBeGreaterThan(0);
    }

    expect(form.find('input[type="file"][name="resume"]').attr("accept")).toContain(".pdf");
  });

  it.each(careerJobs.map((job) => [job.title, job]))(
    "career detail page for %s exposes a pre-selected apply form",
    (_title, job) => {
      const $ = loadPage(job.page);
      expectCareerDetailApplyForm($, job);
      expect(loadPage(job.page)('form[data-netlify="true"]').length).toBe(0);
    },
  );
});
