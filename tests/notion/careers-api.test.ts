import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@notionhq/client";
import { hasNotionCareersConfig, loadDotEnv } from "../helpers/env";
import {
  createApplicationPage,
  fetchOpenJobs,
  normalizeNotionDatabaseId,
  readApplicationPage,
} from "../../netlify/functions/shared/notion.mjs";

loadDotEnv();

const notionConfigured = hasNotionCareersConfig();

const TEST_RESUME_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Size 3/Root 1 0 R>>\n%%EOF\n",
);

function createTestResumeFile() {
  return {
    name: "ci-test-resume.pdf",
    type: "application/pdf",
    size: TEST_RESUME_BYTES.length,
    arrayBuffer: async () =>
      TEST_RESUME_BYTES.buffer.slice(
        TEST_RESUME_BYTES.byteOffset,
        TEST_RESUME_BYTES.byteOffset + TEST_RESUME_BYTES.byteLength,
      ),
  };
}

describe.skipIf(!notionConfigured)("Notion careers live API", () => {
  const runId = `ci-${Date.now()}`;
  let seededJobPageId = "";

  beforeAll(async () => {
    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    const search = await notion.search({
      filter: { property: "object", value: "database" },
      page_size: 20,
    });

    if (search.results.length === 0) {
      throw new Error(
        'SMC-careers integration has no database access. In Notion, open each database → ⋯ → Connections → add "SMC-careers", then run npm run verify:notion.',
      );
    }

    const jobsId = normalizeNotionDatabaseId(process.env.NOTION_JOBS_DATABASE_ID || "");
    try {
      await notion.databases.retrieve({ database_id: jobsId });
    } catch {
      const titles = search.results
        .map((db) => db.title?.map((part) => part.plain_text).join("") || db.id)
        .join(", ");
      throw new Error(
        `NOTION_JOBS_DATABASE_ID does not match an accessible database. Shared databases: ${titles}. Run npm run verify:notion.`,
      );
    }

    const { jobs, source } = await fetchOpenJobs();
    if (source === "notion" && jobs.length === 0) {
      const page = await notion.pages.create({
        parent: { database_id: jobsId },
        properties: {
          Title: { title: [{ text: { content: "Notion CI Test Role" } }] },
          "Job ID": { rich_text: [{ text: { content: `CI-${runId}` } }] },
          Location: { rich_text: [{ text: { content: "Remote" } }] },
          "Employment Type": { select: { name: "Full-time" } },
          Status: { select: { name: "Open" } },
          "Sort Order": { number: 99 },
        },
      });
      seededJobPageId = page.id;
    }
  });

  afterAll(async () => {
    if (!seededJobPageId) return;
    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    await notion.pages.update({ page_id: seededJobPageId, archived: true });
  });

  it("fetches open jobs from the Notion jobs database", async () => {
    const { jobs, source } = await fetchOpenJobs();

    if (source === "fallback") {
      throw new Error(
        "Notion jobs query fell back to static data. Share both databases with your " +
          'integration (⋯ → Connections → "SMC-careers") and confirm NOTION_JOBS_DATABASE_ID.',
      );
    }

    expect(source).toBe("notion");
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      location: expect.any(String),
      type: expect.any(String),
      label: expect.stringMatching(/\(.+\)$/),
    });
  });

  it("creates an application row in the Notion applications database", async () => {
    const page = await createApplicationPage({
      name: "Notion CI Test",
      email: `careers-notion+${runId}@example.com`,
      phone: "+1 555 010 0199",
      position: "General Application",
      linkedin: "",
      message: `Automated Notion careers test (${runId}). Safe to delete.`,
      resumeFile: createTestResumeFile(),
    });

    expect(page.id).toBeTruthy();

    const application = readApplicationPage(page);
    expect(application.hasResume).toBe(true);
  });
});
