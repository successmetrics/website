import { describe, expect, it } from "vitest";
import { loadPage } from "../helpers/site";
import { NETLIFY_FORMS, readNetlifyToml } from "../helpers/netlify";

const netlifyToml = readNetlifyToml();

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
    for (const slug of ["careers", "services", "contact", "success-stories"]) {
      expect(netlifyToml).toContain(`from = "/${slug}"`);
      expect(netlifyToml).toContain(`to = "/${slug}.html"`);
    }
  });

  it.skipIf(netlifyToml === null)("caches versioned static assets", () => {
    expect(netlifyToml).toContain('for = "/assets/css/*"');
    expect(netlifyToml).toContain('for = "/assets/js/*"');
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

  it("neither form registers Netlify Forms anymore", () => {
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

  it("careers form exposes all expected submission fields including resume upload", () => {
    const form = loadPage("careers.html")("#job-application-form");

    for (const field of NETLIFY_FORMS.jobApplication.fields) {
      expect(form.find(`[name="${field}"]`).length).toBeGreaterThan(0);
    }

    expect(form.find('input[type="file"][name="resume"]').attr("accept")).toContain(".pdf");
  });
});
