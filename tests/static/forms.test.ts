import { describe, expect, it } from "vitest";
import { loadPage } from "../helpers/site";
import { NETLIFY_FORMS } from "../helpers/netlify";
import { loadCareerJobPages } from "../helpers/careers.mjs";

const careerJobs = loadCareerJobPages();

function expectCareerDetailApplyForm($: ReturnType<typeof loadPage>, job: (typeof careerJobs)[number]) {
  const form = $("#job-application-form");

  expect(form.length).toBe(1);
  expect($(".job-detail-content").length).toBe(1);
  expect($(".job-detail-apply").length).toBe(1);
  expect($("body").attr("data-preselected-role")).toBe(job.label);
  expect($(".job-detail-content .job-section").length).toBeGreaterThan(0);
  expect($(".job-desc-heading").length).toBeGreaterThan(0);
  expect(form.attr("data-netlify")).toBeUndefined();
}

describe("form submissions", () => {
  it("contact form posts to the contact API", () => {
    const $ = loadPage("contact.html");
    const form = $("#contact-form");

    expect(form.length).toBe(1);
    expect(form.attr("method")).toBe("POST");
    expect(form.attr("data-netlify")).toBeUndefined();
    expect(form.find('input[name="bot-field"]').length).toBe(1);

    for (const field of ["name", "email", "company", "message"]) {
      expect(form.find(`[name="${field}"][required]`).length).toBe(1);
    }

    expect(form.find('select[name="interest"] option').length).toBeGreaterThanOrEqual(5);
    expect($('script[src="assets/js/contact.js"]').length).toBe(1);
    expect($("#form-status").length).toBe(1);
  });

  it("careers application form posts to the careers API with file upload", () => {
    const $ = loadPage("careers.html");
    const form = $("#job-application-form");

    expect(form.length).toBe(1);
    expect(form.attr("method")).toBe("POST");
    expect(form.attr("enctype")).toBe("multipart/form-data");
    expect(form.attr("data-netlify")).toBeUndefined();
    expect(form.find('input[name="bot-field"]').length).toBe(1);

    for (const field of ["name", "email", "position", "message"]) {
      expect(form.find(`[name="${field}"][required]`).length).toBe(1);
    }

    expect(form.find('input[type="file"][name="resume"][required]').length).toBe(1);
    expect($('script[src="assets/js/careers.js"]').length).toBe(1);
    expect($("#job-list").length).toBe(1);
    expect($("#form-status").length).toBe(1);
  });
});

describe("careers pages", () => {
  it("includes dynamic job board containers on the index page", () => {
    const $ = loadPage("careers.html");

    expect($("#job-list").length).toBe(1);
    expect($("#role option").length).toBeGreaterThan(0);
  });

  it.each(careerJobs.map((job) => [job.title, job]))(
    "builds %s detail page with structured job description and apply form",
    (_title, job) => {
      const $ = loadPage(job.page);
      expectCareerDetailApplyForm($, job);
    },
  );
});

describe("form API routes", () => {
  it("maps both forms to Netlify function endpoints", () => {
    expect(NETLIFY_FORMS.contact.api).toBe("/api/contact");
    expect(NETLIFY_FORMS.jobApplication.api).toBe("/api/job-application");
  });
});
