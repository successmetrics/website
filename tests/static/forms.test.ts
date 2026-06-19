import { describe, expect, it } from "vitest";
import { loadPage } from "../helpers/site";

describe("Netlify forms", () => {
  it("contact form is configured for Netlify with required fields", () => {
    const $ = loadPage("contact.html");
    const form = $('form[name="contact"]');

    expect(form.length).toBe(1);
    expect(form.attr("method")).toBe("POST");
    expect(form.attr("data-netlify")).toBe("true");
    expect(form.find('input[name="form-name"]').attr("value")).toBe("contact");
    expect(form.find('input[name="bot-field"]').length).toBe(1);

    for (const field of ["name", "email", "company", "message"]) {
      expect(form.find(`[name="${field}"][required]`).length).toBe(1);
    }

    expect(form.find('select[name="interest"] option').length).toBeGreaterThanOrEqual(5);
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
