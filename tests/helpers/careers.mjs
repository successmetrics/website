import { readFileSync } from "node:fs";
import { join } from "node:path";

export function loadCareerJobPages() {
  const jobs = JSON.parse(
    readFileSync(join(process.cwd(), "data/careers-fallback.json"), "utf8"),
  );

  return jobs.map((job) => ({
    slug: job.slug,
    page: `careers/${job.slug}.html`,
    path: job.detailUrl,
    label: job.label,
    id: job.id,
    title: job.title,
  }));
}
