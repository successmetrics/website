import { describe, expect, it } from "vitest";
import { loadPage } from "../helpers/site";
import { NETLIFY_FORMS } from "../helpers/netlify";

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

describe("careers page", () => {
  it("includes dynamic job board containers and fallback data", () => {
    const $ = loadPage("careers.html");

    expect($("#job-list").length).toBe(1);
    expect($("#role option").length).toBeGreaterThan(0);
  });
});

describe("form API routes", () => {
  it("maps both forms to Netlify function endpoints", () => {
    expect(NETLIFY_FORMS.contact.api).toBe("/api/contact");
    expect(NETLIFY_FORMS.jobApplication.api).toBe("/api/job-application");
  });
});
