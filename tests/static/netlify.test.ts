import { describe, expect, it } from "vitest";
import { loadPage } from "../helpers/site";
import { NETLIFY_FORMS, readNetlifyToml } from "../helpers/netlify";

const netlifyToml = readNetlifyToml();

describe("netlify.toml", () => {
  it.skipIf(netlifyToml === null)("exposes careers API routes", () => {
    expect(netlifyToml).toContain('from = "/api/jobs"');
    expect(netlifyToml).toContain('from = "/api/job-application"');
  });

  it.skipIf(netlifyToml === null)("runs the site build before publish", () => {
    expect(netlifyToml).toMatch(/command\s*=\s*"npm run build"/);
  });

  it.skipIf(netlifyToml === null)("sets site/ as the publish directory", () => {
    expect(netlifyToml).toMatch(/publish\s*=\s*"site"/);
  });

  it.skipIf(netlifyToml === null)("defines clean URLs for main pages", () => {
    for (const slug of ["careers", "services", "contact"]) {
      expect(netlifyToml).toContain(`from = "/${slug}"`);
      expect(netlifyToml).toContain(`to = "/${slug}.html"`);
    }
  });

  it.skipIf(netlifyToml === null)("caches the shared stylesheet", () => {
    expect(netlifyToml).toContain('for = "/assets/css/styles.css"');
  });
});

describe("Netlify form markup", () => {
  it("contact form meets Netlify requirements", () => {
    const $ = loadPage("contact.html");
    const form = $('form[name="contact"]');

    expect(form.length).toBe(1);
    expect(form.attr("method")?.toUpperCase()).toBe("POST");
    expect(form.attr("data-netlify")).toBe("true");
    expect(form.attr("netlify-honeypot")).toBe("bot-field");
    expect(form.find('input[name="form-name"]').attr("value")).toBe("contact");
    expect(form.find('input[name="bot-field"]').length).toBe(1);
    expect(form.attr("enctype")).toBeUndefined();
  });

  it("careers application form uses the API handler instead of Netlify Forms", () => {
    const $ = loadPage("careers.html");
    const form = $("#job-application-form");

    expect(form.length).toBe(1);
    expect(form.attr("data-netlify")).toBeUndefined();
    expect(form.attr("enctype")).toBe("multipart/form-data");
    expect(form.find('input[name="bot-field"]').length).toBe(1);
  });

  it("registers the contact Netlify form across the site", () => {
    const contact = loadPage("contact.html")('form[data-netlify="true"]');
    const careers = loadPage("careers.html")('form[data-netlify="true"]');

    expect(contact.length).toBe(1);
    expect(careers.length).toBe(0);
    expect(contact.attr("name")).toBe("contact");
  });

  it("contact form exposes all expected submission fields", () => {
    const form = loadPage("contact.html")('form[name="contact"]');

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
