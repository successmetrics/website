import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { applySeoToHtml, loadSeoConfig } from "./seo.mjs";

const ROOT = process.cwd();
const seo = loadSeoConfig(ROOT);
const SOURCE_DIR = join(ROOT, "site", "content", "career-oppurtunities");
const OUTPUT_DIR = join(ROOT, "site", "careers");
const FALLBACK_PATH = join(ROOT, "data", "careers-fallback.json");
const INDEX_PATH = join(ROOT, "site", "data", "careers-job-index.json");

const JOB_ORDER = [
  "senior-salesforce-developer-0084",
  "salesforce-architect-0082",
  "salesforce-developer-0081",
];

const TITLE_OVERRIDES = {
  "salesforce-developer-0081": "Salesforce Developer",
  "salesforce-architect-0082": "Salesforce Architect",
  "senior-salesforce-developer-0084": "Senior Salesforce Developer",
};

const LIST_SECTIONS =
  /^(Key Responsibilities|Required Qualifications|Preferred Qualifications)/i;

const SECTION_HEADINGS =
  /^(About the Role|Key Responsibilities|Required Qualifications|Preferred Qualifications|Why Join Us\??)/i;

function isDividerLine(line) {
  return /^[⸻—-]{1,}$/.test(line) || line === "---";
}

function isSectionHeading(line) {
  return SECTION_HEADINGS.test(line);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cleanLine(line) {
  return line.replace(/\u200b/g, "").trim();
}

function titleFromSlug(slug) {
  if (TITLE_OVERRIDES[slug]) return TITLE_OVERRIDES[slug];
  const base = slug.replace(/-\d{4}$/, "");
  return base
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function jobIdFromSlug(slug) {
  const match = slug.match(/-(\d{4})$/);
  return match ? `JD-${match[1]}` : slug.toUpperCase();
}

function parseMetaFromText(text) {
  const locationMatch = text.match(/^Location:\s*(.+)$/im);
  const typeMatch = text.match(/^Employment Type:\s*(.+)$/im);

  return {
    location: locationMatch?.[1]?.trim() || "Pondicherry, India",
    type: typeMatch?.[1]?.trim() || "Full-time",
  };
}

function splitSections(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\u200b/g, "");
  const lines = normalized.split("\n").map(cleanLine);

  const sections = [];
  let current = null;

  for (const line of lines) {
    if (!line || isDividerLine(line)) continue;

    if (isSectionHeading(line)) {
      if (current) sections.push(current);
      current = { heading: line.replace(/\?+$/, "?"), bodyLines: [] };
      continue;
    }

    if (!current) {
      current = { heading: "About the Role", bodyLines: [] };
    }

    if (!/^Location:/i.test(line) && !/^Employment Type:/i.test(line)) {
      current.bodyLines.push(line);
    }
  }

  if (current) sections.push(current);
  return sections;
}

function sectionClass(heading) {
  if (/^About the Role/i.test(heading)) return "job-section job-section--about";
  if (/^Why Join Us/i.test(heading)) return "job-section job-section--benefits";
  return "job-section";
}

function renderSection(section) {
  const heading = escapeHtml(section.heading);
  const wrapperStart = `<section class="${sectionClass(section.heading)}">`;
  const wrapperEnd = "</section>";
  const h2 = `<h2 class="job-desc-heading">${heading}</h2>`;

  if (LIST_SECTIONS.test(section.heading)) {
    const items = section.bodyLines
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("\n        ");
    return `${wrapperStart}
      ${h2}
      <ul class="job-desc-list">
        ${items}
      </ul>
    ${wrapperEnd}`;
  }

  if (/^Why Join Us/i.test(section.heading)) {
    const splitAt = section.bodyLines.findIndex((line) => /:\s*$/.test(line));
    let introLines = section.bodyLines;
    let listLines = [];

    if (splitAt >= 0) {
      introLines = section.bodyLines.slice(0, splitAt + 1);
      listLines = section.bodyLines.slice(splitAt + 1);
    } else if (section.bodyLines.length > 1) {
      introLines = [section.bodyLines[0]];
      listLines = section.bodyLines.slice(1);
    }

    let html = `${wrapperStart}\n      ${h2}\n      <div class="job-desc-body">`;
    html += introLines.map((line) => `\n        <p>${escapeHtml(line)}</p>`).join("");
    html += "\n      </div>";
    if (listLines.length) {
      html += `\n      <ul class="job-desc-list job-desc-list--benefits">\n        ${listLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("\n        ")}\n      </ul>`;
    }
    html += `\n    ${wrapperEnd}`;
    return html;
  }

  const paragraphs = section.bodyLines
    .map((line) => `        <p>${escapeHtml(line)}</p>`)
    .join("\n");
  return `${wrapperStart}
      ${h2}
      <div class="job-desc-body">
${paragraphs}
      </div>
    ${wrapperEnd}`;
}

function parseOpportunityText(text) {
  const meta = parseMetaFromText(text);
  const sections = splitSections(text);
  const bodyHtml = sections.map(renderSection).join("\n\n    ");
  return { meta, bodyHtml };
}

function renderJobPage(slug, job) {
  const pageKey = `careers/${slug}.html`;
  const seoBlock = applySeoToHtml(
    '<title>placeholder</title>\n<meta name="description" content="placeholder">',
    pageKey,
    seo,
    process.env.GOOGLE_ANALYTICS_ID?.trim() || "",
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${seoBlock}
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="icon" type="image/svg+xml" href="../assets/images/logo.svg">
<link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body class="careers-detail-page" data-preselected-role="${escapeHtml(job.label)}">

<!-- @nav active="careers" -->
<nav class="nav">
  <div class="nav-inner">
    <a href="/index.html" class="logo"><img src="/assets/images/logo.svg" class="mark" alt="SuccessMetrics logo">Success<span class="sm">Metrics</span></a>
    <ul class="nav-links" id="navLinks">
      <li><a href="/services.html">Services</a></li>
      <li><a href="/industries.html">Industries</a></li>
      <li><a href="/accelerators.html">Accelerators</a></li>
      <li><a href="/resources.html">Resources</a></li>
      <li><a href="/ai-research.html">AI Research</a></li>
      <li><a href="/success-stories.html">Success Stories</a></li>
      <li><a href="/careers.html" class="active">Careers</a></li>
      <li><a href="/about.html">About</a></li>
      <li><a href="/contact.html" class="nav-cta">Talk to an Expert</a></li>
    </ul>
    <button class="hamburger" onclick="document.getElementById('navLinks').classList.toggle('open')" aria-label="Menu"><span></span><span></span><span></span></button>
  </div>
</nav>

<header class="page-hero page-hero--compact">
  <div class="container">
    <p class="job-detail-back"><a href="../careers.html#openings">← Back to openings</a></p>
    <div class="kicker">Careers</div>
    <h1>${escapeHtml(job.title)}</h1>
    <p class="job-detail-meta"><span>${escapeHtml(job.id)}</span><span>📍 ${escapeHtml(job.location)}</span><span>${escapeHtml(job.type)}</span></p>
  </div>
</header>

<section class="block">
  <div class="container job-detail-layout">
    <article class="job-detail-content prose prose--job">
      ${job.bodyHtml}
    </article>

    <aside class="job-detail-apply" id="apply">
      <div class="section-head">
        <div class="kicker">Apply</div>
        <h2 class="title">Submit your application</h2>
        <p>Applying for <strong>${escapeHtml(job.label)}</strong></p>
      </div>

      <div id="form-status" class="form-status" hidden role="status" aria-live="polite"></div>
      <form class="form-card" id="job-application-form" name="job-application" method="POST" enctype="multipart/form-data" novalidate>
        <p style="display:none;"><label>Don't fill this out: <input name="bot-field"></label></p>
        <div class="form-grid">
          <div class="field">
            <label for="name">Full Name *</label>
            <input type="text" id="name" name="name" required placeholder="Jane Doe">
          </div>
          <div class="field">
            <label for="email">Email *</label>
            <input type="email" id="email" name="email" required placeholder="jane@example.com">
          </div>
          <div class="field">
            <label for="phone">Phone</label>
            <input type="tel" id="phone" name="phone" placeholder="+91 / +1 ...">
          </div>
          <div class="field">
            <label for="role">Position *</label>
            <select id="role" name="position" required>
              <option value="">Loading roles…</option>
            </select>
          </div>
          <div class="field full">
            <label for="linkedin">LinkedIn / Portfolio URL</label>
            <input type="url" id="linkedin" name="linkedin" placeholder="https://linkedin.com/in/...">
          </div>
          <div class="field full">
            <label for="resume">Resume (PDF or Word, max 8 MB) *</label>
            <input type="file" id="resume" name="resume" required accept=".pdf,.doc,.docx">
          </div>
          <div class="field full">
            <label for="message">Why SuccessMetrics? *</label>
            <textarea id="message" name="message" required placeholder="Tell us briefly about your experience and what excites you about this role…"></textarea>
          </div>
        </div>
        <div style="margin-top: 24px;">
          <button type="submit" class="btn btn-primary">Submit Application →</button>
        </div>
        <p class="form-note">Prefer email? Send your resume directly to <a href="mailto:careers@successmetrics.io">careers@successmetrics.io</a> with the Job ID in the subject line.</p>
      </form>
    </aside>
  </div>
</section>

<footer>
  <div class="container">
    <div class="footer-bottom" style="border-top: none; padding-top: 0;">
      <div>© 2026 SuccessMetrics Corp. All rights reserved.</div>
      <div><a href="../careers.html#openings">← Back to Careers</a></div>
    </div>
  </div>
</footer>

<script src="../assets/js/careers.js" defer></script>
</body>
</html>
`;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(join(ROOT, "site", "data"), { recursive: true });

const fallbackJobs = [];
const jobIndex = {};

for (const slug of JOB_ORDER) {
  const sourcePath = join(SOURCE_DIR, `${slug}.txt`);
  const text = readFileSync(sourcePath, "utf8");
  const parsed = parseOpportunityText(text);
  const id = jobIdFromSlug(slug);
  const title = titleFromSlug(slug);
  const label = `${title} (${id})`;
  const detailUrl = `/careers/${slug}`;

  const job = {
    id,
    title,
    location: parsed.meta.location,
    type: parsed.meta.type,
    label,
    slug,
    detailUrl,
    bodyHtml: parsed.bodyHtml,
  };

  const htmlPath = join(OUTPUT_DIR, `${slug}.html`);
  writeFileSync(htmlPath, renderJobPage(slug, job));
  console.log(`Built ${htmlPath}`);

  fallbackJobs.push({
    id: job.id,
    title: job.title,
    location: job.location,
    type: job.type,
    label: job.label,
    slug: job.slug,
    detailUrl: job.detailUrl,
  });

  jobIndex[job.id] = {
    slug: job.slug,
    detailUrl: job.detailUrl,
  };
}

writeFileSync(FALLBACK_PATH, `${JSON.stringify(fallbackJobs, null, 2)}\n`);
writeFileSync(INDEX_PATH, `${JSON.stringify(jobIndex, null, 2)}\n`);
console.log(`Updated ${FALLBACK_PATH}`);
console.log(`Wrote ${INDEX_PATH}`);
