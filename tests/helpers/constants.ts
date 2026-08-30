export const SITE_DIR = "site";

export const MAIN_PAGES = [
  "index.html",
  "services.html",
  "industries.html",
  "accelerators.html",
  "easymask.html",
  "safe-seed.html",
  "org-insights.html",
  "lpi-accelerator.html",
  "fi-accelerator.html",
  "how-we-work.html",
  "why-ai-salesforce.html",
  "customer-questions.html",
  "resources.html",
  "ai-research.html",
  "success-stories.html",
  "careers.html",
  "about.html",
  "contact.html",
] as const;

export const CONTENT_PAGES = [
  "content/blog-ai-enabled-delivery.html",
  "content/blog-midmarket-salesforce.html",
  "content/blog-lpi-accelerator.html",
  "content/whitepaper-midmarket-guide.html",
  "content/whitepaper-safe-seed-synthetic-data.html",
  "content/ai-research/off-grid-ai-lab-patient-trial-matching.html",
  "content/ai-research/beyond-masking-synthetic-data.html",
  "content/success-stories/amp-customer-portal-success-story.html",
  "content/success-stories/caloes-ppe-portal-success-story.html",
  "content/success-stories/leaflink-cpq-success-story.html",
  "content/success-stories/sfhss-agentforce-success-story.html",
  "content/success-stories/mohcd-agentforce-success-story.html",
  "content/success-stories/city-permitting-success-story.html",
  "content/success-stories/easymask-product-engineering-success-story.html",
  "content/success-stories/state-licensing-modernization-success-story.html",
  "careers/forward-deployed-engineer-0085.html",
  "careers/senior-salesforce-developer-0084.html",
  "careers/salesforce-architect-0082.html",
  "careers/salesforce-developer-0081.html",
] as const;

export const NAV_LINKS = [
  { label: "AI Solutions", href: "/services.html" },
  { label: "Industries", href: "/industries.html" },
  { label: "Accelerators", href: "/accelerators.html" },
  { label: "Resources", href: "/resources.html" },
  { label: "AI Research", href: "/ai-research.html" },
  { label: "Success Stories", href: "/success-stories.html" },
  { label: "Careers", href: "/careers.html" },
  { label: "About", href: "/about.html" },
  { label: "Talk to an Engineer", href: "/contact.html" },
] as const;

export const NETLIFY_CLEAN_URLS: Record<string, string> = {
  "/careers": "careers.html",
  "/services": "services.html",
  "/industries": "industries.html",
  "/accelerators": "accelerators.html",
  "/resources": "resources.html",
  "/ai-research": "ai-research.html",
  "/success-stories": "success-stories.html",
  "/about": "about.html",
  "/contact": "contact.html",
  "/easymask": "easymask.html",
  "/safe-seed": "safe-seed.html",
  "/org-insights": "org-insights.html",
  "/lpi-accelerator": "lpi-accelerator.html",
  "/fi-accelerator": "fi-accelerator.html",
  "/how-we-work": "how-we-work.html",
  "/why-ai-salesforce": "why-ai-salesforce.html",
  "/customer-questions": "customer-questions.html",
};

export const STYLESHEET = "assets/css/styles.css";
export const LOGO = "assets/images/logo.svg";
export const OG_DEFAULT_IMAGE = "assets/images/og-default.png";
