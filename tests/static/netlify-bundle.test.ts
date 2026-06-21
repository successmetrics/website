import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSync } from "esbuild";

const functionEntries = [
  "netlify/functions/contact.mjs",
  "netlify/functions/jobs.mjs",
  "netlify/functions/job-application.mjs",
];

describe("Netlify function bundles", () => {
  it.each(functionEntries)("esbuild can bundle %s without duplicate __dirname", (entry) => {
    const result = buildSync({
      entryPoints: [join(process.cwd(), entry)],
      bundle: true,
      platform: "node",
      format: "esm",
      write: false,
      logLevel: "silent",
    });

    const output = result.outputFiles?.[0]?.text ?? "";
    expect(output.length).toBeGreaterThan(0);
    expect(output).not.toMatch(/\bconst __dirname\b/);
  });

  it("notion helper source avoids declaring __dirname", () => {
    const source = readFileSync(
      join(process.cwd(), "netlify/functions/shared/notion.mjs"),
      "utf8",
    );
    expect(source).not.toMatch(/\bconst __dirname\b/);
  });
});
