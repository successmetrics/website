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

  it("careers application form is configured for Netlify with file upload", () => {
    const $ = loadPage("careers.html");
    const form = $('form[name="job-application"]');

    expect(form.length).toBe(1);
    expect(form.attr("method")).toBe("POST");
    expect(form.attr("data-netlify")).toBe("true");
    expect(form.attr("enctype")).toBe("multipart/form-data");
    expect(form.find('input[name="form-name"]').attr("value")).toBe("job-application");

    for (const field of ["name", "email", "position", "message"]) {
      expect(form.find(`[name="${field}"][required]`).length).toBe(1);
    }

    expect(form.find('input[type="file"][name="resume"][required]').length).toBe(1);

    const roles = form
      .find('select[name="position"] option')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);

    expect(roles).toContain("Senior Salesforce Developer (JD-0084)");
    expect(roles).toContain("General Application");
  });
});

describe("careers page", () => {
  it("lists all four open job IDs", () => {
    const html = loadPage("careers.html").html() ?? "";

    for (const jobId of ["JD-0081", "JD-0082", "JD-0083", "JD-0084"]) {
      expect(html).toContain(jobId);
    }
  });
});
