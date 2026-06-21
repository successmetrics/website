const siteUrl = (process.argv[2] || process.env.NETLIFY_SITE_URL || "https://successmetrics.io")
  .replace(/\/$/, "");

async function check(path) {
  const response = await fetch(`${siteUrl}${path}`, {
    redirect: "follow",
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { path, status: response.status, body };
}

const checks = await Promise.all([
  check("/api/health"),
  check("/api/jobs"),
]);

for (const result of checks) {
  console.log(`${result.path} → HTTP ${result.status}`);
  console.log(JSON.stringify(result.body, null, 2));
}

const health = checks[0];
const jobs = checks[1];

if (!health.body?.env?.RESEND_API_KEY) {
  console.error(
    "\nRESEND_API_KEY is not visible to Netlify Functions. In Netlify → Environment variables, set scope to Functions (or All) and redeploy.",
  );
  process.exitCode = 1;
}

if (jobs.body?.errorMessage?.includes("__dirname")) {
  console.error(
    "\nCareers functions are running an old deploy. Trigger a new deploy from the test branch (commit with moduleDir fix).",
  );
  process.exitCode = 1;
}

if (jobs.status >= 500) {
  console.error("\n/api/jobs is failing on the deployed site.");
  process.exitCode = 1;
}
