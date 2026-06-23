import { describe, expect, it } from "vitest";
import {
  isOpenJob,
  normalizeNotionDatabaseId,
  parseJobPage,
  toPublicJob,
} from "../../netlify/functions/shared/notion.mjs";

describe("notion careers helpers", () => {
  it("normalizes a Notion database URL using the p= database id", () => {
    const id = normalizeNotionDatabaseId(
      "https://app.notion.com/p/3849fd5117b180dabee5d3b29b3b04b8?v=3849fd5117b180ae9a33000c8cf20926",
    );
    expect(id).toBe("3849fd51-17b1-80da-bee5-d3b29b3b04b8");
  });

  it("passes through an existing UUID", () => {
    expect(normalizeNotionDatabaseId("3849fd51-17b1-80da-beee-5d3b29b3b04b8")).toBe(
      "3849fd51-17b1-80da-beee-5d3b29b3b04b8",
    );
  });

  it("parses an open job page from Notion properties", () => {
    const job = parseJobPage({
      id: "page-1",
      properties: {
        Title: { title: [{ plain_text: "Salesforce Developer" }] },
        "Job ID": { rich_text: [{ plain_text: "JD-0081" }] },
        Location: { rich_text: [{ plain_text: "Pondicherry, India" }] },
        "Employment Type": { select: { name: "Full-time" } },
        Status: { select: { name: "Open" } },
        "Sort Order": { number: 4 },
      },
    });

    expect(isOpenJob(job)).toBe(true);
    expect(toPublicJob(job)).toEqual({
      id: "JD-0081",
      title: "Salesforce Developer",
      location: "Pondicherry, India",
      type: "Full-time",
      label: "Salesforce Developer (JD-0081)",
      slug: null,
      detailUrl: null,
    });
  });

  it("includes slug and detailUrl when present on fallback jobs", () => {
    expect(
      toPublicJob({
        id: "JD-0081",
        title: "Salesforce Developer",
        location: "Pondicherry, India",
        type: "Full-time",
        slug: "salesforce-developer-0081",
        detailUrl: "/careers/salesforce-developer-0081",
      }),
    ).toEqual({
      id: "JD-0081",
      title: "Salesforce Developer",
      location: "Pondicherry, India",
      type: "Full-time",
      label: "Salesforce Developer (JD-0081)",
      slug: "salesforce-developer-0081",
      detailUrl: "/careers/salesforce-developer-0081",
    });
  });

  it("filters closed jobs", () => {
    const job = parseJobPage({
      id: "page-2",
      properties: {
        Title: { title: [{ plain_text: "Closed Role" }] },
        "Job ID": { rich_text: [{ plain_text: "JD-0001" }] },
        Status: { select: { name: "Closed" } },
      },
    });

    expect(isOpenJob(job)).toBe(false);
  });
});
