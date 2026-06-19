import { Client } from "@notionhq/client";
import { readFileSync, existsSync } from "node:fs";
import { normalizeNotionDatabaseId } from "../netlify/functions/shared/notion.mjs";

function loadDotEnv(path = ".env") {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const token = process.env.NOTION_TOKEN?.trim();
if (!token) {
  console.error("NOTION_TOKEN is missing. Copy .env.example to .env first.");
  process.exit(1);
}

const notion = new Client({ auth: token });

const jobsId = normalizeNotionDatabaseId(process.env.NOTION_JOBS_DATABASE_ID || "");
const appsId = normalizeNotionDatabaseId(process.env.NOTION_APPLICATIONS_DATABASE_ID || "");

console.log("Checking Notion careers setup...\n");

const me = await notion.users.me();
console.log(`Integration: ${me.name || me.id} (${me.type})`);

const search = await notion.search({
  filter: { property: "object", value: "database" },
  page_size: 20,
});

if (search.results.length === 0) {
  console.log("\nNo databases are shared with this integration yet.\n");
  console.log("Fix:");
  console.log("  1. Open your Jobs database in Notion");
  console.log('  2. Click ⋯ (top right) → Connections → add "SMC-careers"');
  console.log("  3. Repeat for the Applications database");
  console.log("  4. Re-run: npm run verify:notion");
  process.exit(1);
}

console.log("\nDatabases shared with this integration:");
for (const db of search.results) {
  const title = db.title?.map((part) => part.plain_text).join("") || "(untitled)";
  console.log(`  - ${title}: ${db.id}`);
}

let ok = true;

for (const [label, id] of [
  ["Jobs", jobsId],
  ["Applications", appsId],
]) {
  if (!id) {
    console.error(`\n${label}: NOTION_*_DATABASE_ID is not set`);
    ok = false;
    continue;
  }

  try {
    const db = await notion.databases.retrieve({ database_id: id });
    const title = db.title?.map((part) => part.plain_text).join("") || db.id;
    const count = (await notion.databases.query({ database_id: id, page_size: 1 })).results
      .length;
    console.log(`\n${label} database OK: "${title}" (${id})`);
    console.log(`  Query test: ${count >= 0 ? "passed" : "failed"}`);
  } catch (error) {
    ok = false;
    console.error(`\n${label} database FAILED (${id})`);
    console.error(`  ${error.message}`);
    console.error(
      "  The URL id does not match a database this integration can access.",
    );
    console.error(
      "  Share the database with SMC-careers, or set NOTION_*_DATABASE_ID to one of the ids listed above.",
    );
  }
}

process.exit(ok ? 0 : 1);
