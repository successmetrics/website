export const SITE_DIR = "site";

export const MAIN_PAGES = [
  "index.html",
  "services.html",
  "industries.html",
  "accelerators.html",
  "resources.html",
  "careers.html",
  "about.html",
  "contact.html",
] as const;

export const CONTENT_PAGES = [
  "content/blog-ai-enabled-delivery.html",
  "content/blog-midmarket-salesforce.html",
  "content/blog-lpi-accelerator.html",
  "content/whitepaper-midmarket-guide.html",
] as const;

export const NAV_LINKS = [
  { label: "Services", href: "services.html" },
  { label: "Industries", href: "industries.html" },
  { label: "Accelerators", href: "accelerators.html" },
  { label: "Resources", href: "resources.html" },
  { label: "Careers", href: "careers.html" },
  { label: "About", href: "about.html" },
  { label: "Talk to an Expert", href: "contact.html" },
] as const;

export const NETLIFY_CLEAN_URLS: Record<string, string> = {
  "/careers": "careers.html",
  "/services": "services.html",
  "/industries": "industries.html",
  "/accelerators": "accelerators.html",
  "/resources": "resources.html",
  "/about": "about.html",
  "/contact": "contact.html",
};

export const STYLESHEET = "assets/css/styles.css";
export const LOGO = "assets/images/logo.svg";
