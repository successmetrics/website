import { describe, expect, it } from "vitest";
import { loadPage } from "../helpers/site";
import { NETLIFY_FORMS, readNetlifyToml } from "../helpers/netlify";

const netlifyToml = readNetlifyToml();

describe("netlify.toml", () => {
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
  it.each([
    ["contact", "contact.html", NETLIFY_FORMS.contact.name, false],
    ["job application", "careers.html", NETLIFY_FORMS.jobApplication.name, true],
  ] as const)(
    "%s form meets Netlify requirements",
    (_label, page, formName, expectsMultipart) => {
      const $ = loadPage(page);
      const form = $(`form[name="${formName}"]`);

      expect(form.length).toBe(1);
      expect(form.attr("method")?.toUpperCase()).toBe("POST");
      expect(form.attr("data-netlify")).toBe("true");
      expect(form.attr("netlify-honeypot")).toBe("bot-field");
      expect(form.find('input[name="form-name"]').attr("value")).toBe(formName);
      expect(form.find('input[name="bot-field"]').length).toBe(1);

      if (expectsMultipart) {
        expect(form.attr("enctype")).toBe("multipart/form-data");
      } else {
        expect(form.attr("enctype")).toBeUndefined();
      }
    },
  );

  it("registers exactly two Netlify forms across the site", () => {
    const contact = loadPage("contact.html")('form[data-netlify="true"]');
    const careers = loadPage("careers.html")('form[data-netlify="true"]');

    expect(contact.length).toBe(1);
    expect(careers.length).toBe(1);
    expect(contact.attr("name")).toBe("contact");
    expect(careers.attr("name")).toBe("job-application");
  });

  it("contact form exposes all expected submission fields", () => {
    const form = loadPage("contact.html")('form[name="contact"]');

    for (const field of NETLIFY_FORMS.contact.fields) {
      expect(form.find(`[name="${field}"]`).length).toBeGreaterThan(0);
    }
  });

  it("careers form exposes all expected submission fields including resume upload", () => {
    const form = loadPage("careers.html")('form[name="job-application"]');

    for (const field of NETLIFY_FORMS.jobApplication.fields) {
      expect(form.find(`[name="${field}"]`).length).toBeGreaterThan(0);
    }

    expect(form.find('input[type="file"][name="resume"]').attr("accept")).toContain(".pdf");
  });
});
