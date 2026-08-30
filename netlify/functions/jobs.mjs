import { fetchOpenJobs } from "./shared/notion.mjs";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export default async function handler() {
  const { jobs, source } = await fetchOpenJobs();
  return new Response(JSON.stringify({ jobs, source }), { status: 200, headers });
}
