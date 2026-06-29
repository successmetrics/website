import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applySeoToHtml, loadSeoConfig } from "./seo.mjs";

const ROOT = process.cwd();
const seo = loadSeoConfig(ROOT);
const STORIES_DIR = join(ROOT, "site", "content", "success-stories");
const INDEX_PATH = join(ROOT, "site", "success-stories.html");

const STORY_ORDER = [
  "amp-customer-portal-success-story",
  "caloes-ppe-portal-success-story",
  "leaflink-cpq-success-story",
  "sfhss-agentforce-success-story",
  "mohcd-agentforce-success-story",
];

const STORY_CONFIG = {
  "amp-customer-portal-success-story": {
    badge: "Public Utility",
    badgeTeal: false,
    badgeBlue: false,
    logo: "alameda-municipal-power.png",
    logoClass: "prose-client-logo--amp",
    thumbLogoClass: "story-client-logo--amp",
    logoWidth: 864,
    logoHeight: 307,
    thumbWidth: 280,
    thumbHeight: 100,
    thumbClass: "thumb-1",
    icon: "⚡",
    pageTitle: "AMP Customer Portal Success Story",
  },
  "caloes-ppe-portal-success-story": {
    badge: "Public Sector",
    badgeTeal: true,
    badgeBlue: false,
    logo: "caloes.jpg",
    logoClass: "prose-client-logo--caloes",
    thumbLogoClass: "story-client-logo--caloes",
    logoWidth: 792,
    logoHeight: 307,
    thumbWidth: 260,
    thumbHeight: 100,
    thumbClass: "thumb-4",
    icon: "🛡️",
    pageTitle: "Cal OES PPE Portal Success Story",
  },
  "leaflink-cpq-success-story": {
    badge: "Technology",
    badgeTeal: false,
    badgeBlue: true,
    logo: "leaflink.svg",
    logoClass: "prose-client-logo--leaflink",
    thumbLogoClass: "story-client-logo--leaflink",
    logoWidth: 136,
    logoHeight: 24,
    thumbWidth: 160,
    thumbHeight: 28,
    thumbClass: "thumb-2",
    icon: "📊",
    pageTitle: "LeafLink CPQ Success Story",
  },
  "sfhss-agentforce-success-story": {
    badge: "Public Sector",
    badgeTeal: false,
    badgeBlue: false,
    logo: "sfhss.svg",
    logoClass: "prose-client-logo--sfhss",
    thumbLogoClass: "story-client-logo--sfhss",
    logoWidth: 160,
    logoHeight: 32,
    thumbWidth: 130,
    thumbHeight: 28,
    thumbClass: "thumb-3",
    icon: "🩺",
    pageTitle: "SFHSS Agentforce Success Story",
  },
  "mohcd-agentforce-success-story": {
    badge: "Public Sector",
    badgeTeal: true,
    badgeBlue: false,
    logo: "mohcd.png",
    logoClass: "prose-client-logo--mohcd",
    thumbLogoClass: "story-client-logo--mohcd",
    logoWidth: 420,
    logoHeight: 107,
    thumbWidth: 300,
    thumbHeight: 77,
    thumbClass: "thumb-2",
    icon: "🏠",
    pageTitle: "MOHCD Agentforce Success Story",
  },
};

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, label, url) => {
      const href = /successmetrics(?:corp)?\.io\/contact|successmetricscorp\.com\/contact/i.test(
        url,
      )
        ? "../../contact.html"
        : url;
      return `<a href="${href}">${label}</a>`;
    },
  );
  return out;
}

function parseStoryMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  if (!lines[index]?.startsWith("# ")) {
    throw new Error("Story markdown must start with an H1 title");
  }

  const title = lines[index].slice(2).trim();
  index += 1;

  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }

  const meta = {};
  while (index < lines.length && lines[index].startsWith("**")) {
    const match = lines[index].match(/^\*\*(.+?):\*\*\s*(.+)$/);
    if (!match) break;
    meta[match[1]] = match[2].trim();
    index += 1;
  }

  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }

  const bodyParts = [];
  const footerParts = [];
  let inList = false;
  let inFooter = false;

  for (; index < lines.length; index += 1) {
    const line = lines[index];

    if (!inFooter && line.trim() === "---") {
      if (inList) {
        bodyParts.push("</ul>");
        inList = false;
      }
      inFooter = true;
      continue;
    }

    if (inFooter) {
      if (line.trim()) footerParts.push(line);
      continue;
    }

    if (line.startsWith("## ")) {
      if (inList) {
        bodyParts.push("</ul>");
        inList = false;
      }
      bodyParts.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      if (inList) {
        bodyParts.push("</ul>");
        inList = false;
      }
      bodyParts.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        bodyParts.push("<ul>");
        inList = true;
      }
      bodyParts.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    if (!line.trim()) {
      if (inList) {
        bodyParts.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (inList) {
      bodyParts.push("</ul>");
      inList = false;
    }
    bodyParts.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (inList) {
    bodyParts.push("</ul>");
  }

  return { title, meta, bodyHtml: bodyParts.join("\n  "), footerLines: footerParts };
}

function challengeExcerpt(markdown) {
  const match = markdown.match(/## The Challenge[^\n]*\n\n([^\n]+)/);
  return match?.[1]?.trim() || "";
}

function renderFooter(footerLines) {
  if (footerLines.length === 0) return "";

  const text = footerLines
    .join(" ")
    .replace(/^\*+|\*+$/g, "")
    .trim();

  return `
  <hr>

  <div class="callout">
    <p>${inlineMarkdown(text)}</p>
  </div>`;
}

function storyBadgeClass(config) {
  if (config.badgeBlue) return ' class="badge blue"';
  if (config.badgeTeal) return ' class="badge teal"';
  return ' class="badge"';
}

function renderStoryPage(slug, parsed) {
  const config = STORY_CONFIG[slug];
  const badgeClass = storyBadgeClass(config);
  const pageKey = `content/success-stories/${slug}.html`;
  const seoBlock = applySeoToHtml(
    "<title>placeholder</title>\n<meta name=\"description\" content=\"placeholder\">",
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
<link rel="icon" type="image/svg+xml" href="../../assets/images/logo.svg">
<link rel="stylesheet" href="../../assets/css/styles.css">
</head>
<body>

<!-- @nav active="success-stories" -->
<article class="prose prose--story">
  <div class="prose-header">
    <div class="prose-header-copy">
      <span${badgeClass}>${config.badge}</span>
      <h1>${inlineMarkdown(parsed.title)}</h1>

      <div class="story-meta">
        <div><strong>Client:</strong> ${inlineMarkdown(parsed.meta.Client || "")}</div>
        <div><strong>Industry:</strong> ${inlineMarkdown(parsed.meta.Industry || "")}</div>
        <div><strong>${parsed.meta.Solutions ? "Solutions" : "Solution"}:</strong> ${inlineMarkdown(parsed.meta.Solutions || parsed.meta.Solution || "")}</div>
        <div><strong>Implementation Partner:</strong> ${inlineMarkdown(parsed.meta["Implementation Partner"] || "")}</div>
      </div>
    </div>
    <img class="prose-client-logo ${config.logoClass}" src="../../assets/images/clients/${config.logo}" alt="${escapeHtml(parsed.meta.Client?.split("(")[0].trim() || slug)}" width="${config.logoWidth}" height="${config.logoHeight}" loading="lazy">
  </div>

  ${parsed.bodyHtml}${renderFooter(parsed.footerLines)}
</article>

<footer>
  <div class="container">
    <div class="footer-bottom" style="border-top: none; padding-top: 0;">
      <div>© 2026 SuccessMetrics Corp. All rights reserved.</div>
      <div><a href="../../success-stories.html">← Back to Success Stories</a></div>
    </div>
  </div>
</footer>

</body>
</html>
`;
}

function renderIndexCard(slug, parsed, markdown) {
  const config = STORY_CONFIG[slug];
  const badgeClass = storyBadgeClass(config);
  const excerpt = challengeExcerpt(markdown);

  return `      <div class="card res-card story-card">
        <div class="thumb ${config.thumbClass} story-card-thumb">
          <span class="story-card-icon" aria-hidden="true">${config.icon}</span>
          <img class="story-client-logo story-client-logo--thumb ${config.thumbLogoClass}" src="assets/images/clients/${config.logo}" alt="${escapeHtml(parsed.meta.Client?.split("(")[0].trim() || slug)}" width="${config.thumbWidth}" height="${config.thumbHeight}" loading="lazy">
        </div>
        <div class="body">
          <span${badgeClass}>${config.badge}</span>
          <h3>${inlineMarkdown(parsed.title)}</h3>
          <p>${inlineMarkdown(excerpt)}</p>
          <a class="link" href="content/success-stories/${slug}.html">Read the story →</a>
        </div>
      </div>`;
}

function updateIndexPage(cards) {
  const html = readFileSync(INDEX_PATH, "utf8");
  const cardBlock = cards.join("\n");
  const markerPattern =
    /<!-- story-cards:start -->[\s\S]*?<!-- story-cards:end -->/;

  if (!markerPattern.test(html)) {
    throw new Error(
      "success-stories.html is missing <!-- story-cards:start/end --> markers",
    );
  }

  const next = html.replace(
    markerPattern,
    `<!-- story-cards:start -->\n${cardBlock}\n      <!-- story-cards:end -->`,
  );

  writeFileSync(INDEX_PATH, next);
}

const cards = [];

for (const slug of STORY_ORDER) {
  const filename = `${slug}.md`;
  if (!STORY_CONFIG[slug]) continue;

  const markdown = readFileSync(join(STORIES_DIR, filename), "utf8");
  const parsed = parseStoryMarkdown(markdown);
  const html = renderStoryPage(slug, parsed);
  const htmlPath = join(STORIES_DIR, `${slug}.html`);

  writeFileSync(htmlPath, html);
  cards.push(renderIndexCard(slug, parsed, markdown));
  console.log(`Built ${htmlPath}`);
}

if (cards.length > 0) {
  updateIndexPage(cards);
  console.log(`Updated ${INDEX_PATH}`);
}
