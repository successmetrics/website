import { readFileSync } from "node:fs";
import { join } from "node:path";

const SEO_MARKER_START = "<!-- seo:start -->";
const SEO_MARKER_END = "<!-- seo:end -->";

export function loadSeoConfig(root = process.cwd()) {
  return JSON.parse(readFileSync(join(root, "data", "seo.json"), "utf8"));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeJsonLd(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function organizationSchema(seo) {
  const org = seo.organization;
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: org.name,
    url: seo.siteOrigin,
    logo: `${seo.siteOrigin}/assets/images/logo.svg`,
    description:
      "AI-enabled Salesforce implementation and consulting for mid-market companies and public sector agencies.",
    telephone: org.telephone,
    email: org.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: org.streetAddress,
      addressLocality: org.addressLocality,
      addressRegion: org.addressRegion,
      postalCode: org.postalCode,
      addressCountry: org.addressCountry,
    },
    areaServed: ["United States", "India"],
    sameAs: [org.linkedin],
    knowsAbout: [
      "Salesforce Implementation",
      "Salesforce Agentforce",
      "Salesforce Public Sector Solutions",
      "AI-Enabled Software Development",
    ],
  };
}

function websiteSchema(seo) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: seo.organization.name,
    url: seo.siteOrigin,
    publisher: {
      "@type": "Organization",
      name: seo.organization.name,
      logo: `${seo.siteOrigin}/assets/images/logo.svg`,
    },
  };
}

function pageSchema(page, seo) {
  const url = `${seo.siteOrigin}${page.path}`;
  const schemas = [];

  for (const type of page.schema || []) {
    if (type === "Organization") {
      schemas.push(organizationSchema(seo));
      continue;
    }
    if (type === "WebSite") {
      schemas.push(websiteSchema(seo));
      continue;
    }
    if (type === "Article") {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: page.title,
        description: page.description,
        url,
        datePublished: page.datePublished || undefined,
        dateModified: page.datePublished || undefined,
        author: {
          "@type": "Organization",
          name: seo.organization.name,
          url: seo.siteOrigin,
        },
        publisher: {
          "@type": "Organization",
          name: seo.organization.name,
          logo: {
            "@type": "ImageObject",
            url: `${seo.siteOrigin}/assets/images/logo.svg`,
          },
        },
        mainEntityOfPage: url,
      });
      continue;
    }
    if (type === "Service") {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Service",
        name: "Salesforce Implementation & Managed Services",
        provider: {
          "@type": "Organization",
          name: seo.organization.name,
          url: seo.siteOrigin,
        },
        description: page.description,
        areaServed: ["United States", "India"],
        serviceType: "Salesforce consulting and implementation",
        url,
      });
      continue;
    }
    if (type === "Product") {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "SuccessMetrics Salesforce Accelerators",
        brand: {
          "@type": "Brand",
          name: seo.organization.name,
        },
        description: page.description,
        url,
      });
      continue;
    }
    if (type === "ContactPage") {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: page.title,
        description: page.description,
        url,
      });
      continue;
    }

    schemas.push({
      "@context": "https://schema.org",
      "@type": type === "CollectionPage" ? "CollectionPage" : "WebPage",
      name: page.title,
      description: page.description,
      url,
    });
  }

  return schemas;
}

export function renderAnalyticsSnippet(gaId) {
  if (!gaId) return "";
  return `
<!-- analytics:start -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(gaId)}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${escapeHtml(gaId)}');
</script>
<!-- analytics:end -->`.trim();
}

export function renderSeoBlock(page, seo, gaId) {
  const url = `${seo.siteOrigin}${page.path}`;
  const ogImage = `${seo.siteOrigin}${page.ogImage || seo.defaultOgImage}`;
  const schemas = pageSchema(page, seo);
  const schemaScripts = schemas
    .map(
      (schema) =>
        `<script type="application/ld+json">${escapeJsonLd(schema)}</script>`,
    )
    .join("\n");

  const analytics = renderAnalyticsSnippet(gaId);

  return `${SEO_MARKER_START}
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="${escapeHtml(page.ogType || "website")}">
<meta property="og:site_name" content="SuccessMetrics">
<meta property="og:title" content="${escapeHtml(page.title)}">
<meta property="og:description" content="${escapeHtml(page.description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(page.title)}">
<meta name="twitter:description" content="${escapeHtml(page.description)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">
${schemaScripts}
${analytics}
${SEO_MARKER_END}`;
}

const SEO_BLOCK_RE = new RegExp(
  `${SEO_MARKER_START}[\\s\\S]*?${SEO_MARKER_END}\\s*`,
  "g",
);

const LEGACY_HEAD_RE =
  /<title>[\s\S]*?<\/title>\s*<meta name="description"[^>]*>\s*(?:<link rel="canonical"[^>]*>\s*)?(?:<meta name="robots"[^>]*>\s*)?(?:<meta property="og:[^"]+"[^>]*>\s*)*(?:<meta name="twitter:[^"]+"[^>]*>\s*)*(?:<script type="application\/ld\+json">[\s\S]*?<\/script>\s*)*(?:<!-- analytics:start -->[\s\S]*?<!-- analytics:end -->\s*)?/;

export function applySeoToHtml(html, pageKey, seo, gaId) {
  const page = seo.pages[pageKey];
  if (!page) {
    throw new Error(`Missing SEO config for ${pageKey}`);
  }

  const block = renderSeoBlock(page, seo, gaId);

  if (html.includes(SEO_MARKER_START)) {
    return html.replace(SEO_BLOCK_RE, `${block}\n`);
  }

  return html.replace(
    LEGACY_HEAD_RE,
    `${block}\n`,
  );
}

export function generateRobotsTxt(seo) {
  return `User-agent: *
Allow: /

Sitemap: ${seo.siteOrigin}/sitemap.xml
`;
}

export function generateSitemapXml(seo) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = Object.entries(seo.sitemap)
    .map(([file, meta]) => {
      const page = seo.pages[file];
      if (!page) return "";
      return `  <url>
    <loc>${seo.siteOrigin}${page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${meta.changefreq}</changefreq>
    <priority>${meta.priority}</priority>
  </url>`;
    })
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}
