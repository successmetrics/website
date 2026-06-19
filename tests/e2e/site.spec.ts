import { test, expect } from "@playwright/test";

const MAIN_PAGES = [
  "index.html",
  "services.html",
  "industries.html",
  "accelerators.html",
  "resources.html",
  "careers.html",
  "about.html",
  "contact.html",
];

const CONTENT_PAGES = [
  "content/blog-ai-enabled-delivery.html",
  "content/blog-midmarket-salesforce.html",
  "content/blog-lpi-accelerator.html",
  "content/whitepaper-midmarket-guide.html",
];

const NAV_LINKS = [
  { href: "services.html" },
  { href: "industries.html" },
  { href: "accelerators.html" },
  { href: "resources.html" },
  { href: "careers.html" },
  { href: "about.html" },
  { href: "contact.html" },
];

const ALL_PAGES = [...MAIN_PAGES, ...CONTENT_PAGES];

test.describe("page smoke tests", () => {
  for (const page of ALL_PAGES) {
    test(`${page} loads successfully`, async ({ page: browserPage }) => {
      const response = await browserPage.goto(`/${page}`);
      expect(response?.status()).toBe(200);
      await expect(browserPage.locator("h1")).toBeVisible();
      await expect(browserPage.locator("nav.nav")).toBeVisible();
      await expect(browserPage.locator("footer")).toBeVisible();
    });
  }

  test("homepage shows primary hero and CTAs", async ({ page }) => {
    await page.goto("/index.html");

    await expect(page.locator("h1")).toContainText("mid-market companies");
    await expect(page.getByRole("link", { name: "Book a Free Assessment →" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore Our Accelerators" })).toBeVisible();
    await expect(page.locator(".stats-bar .stat")).toHaveCount(4);
  });

  test("homepage shows client logo marquee", async ({ page }) => {
    await page.goto("/index.html");

    await expect(page.locator(".client-marquee-section")).toBeVisible();
    await expect(page.locator("#client-marquee-title")).toHaveText("Trusted By");
    await expect(page.locator(".client-marquee")).toBeVisible();
    await expect(page.locator('.client-logo img[alt="RLI"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="Cal OES"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="Alameda Municipal Power"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="Roller Software"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="Caltrans"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="RPM"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="LeafLink"]')).toBeVisible();
  });

  test("homepage shows partner logos", async ({ page }) => {
    await page.goto("/index.html");

    await expect(page.locator(".partners-section")).toBeVisible();
    await expect(page.locator('.partner-logo img[alt="Salesforce"]')).toBeVisible();
    await expect(page.locator('.partner-logo img[alt="Carahsoft"]')).toBeVisible();
    await expect(page.locator('.partner-logo img[alt="dotSolved"]')).toBeVisible();
    await expect(page.locator('.partner-logo img[alt="5M"]')).toBeVisible();
    await expect(page.locator('.partner-logo img[alt="Odaseva"]')).toBeVisible();
    await expect(page.locator('.partner-logo img[alt="Xtech.com"]')).toBeVisible();
    await expect(page.locator(".partner-logo")).toHaveCount(6);
  });
});

test.describe("navigation", () => {
  test("primary nav links route to the correct pages", async ({ page }) => {
    await page.goto("/index.html");

    for (const { href } of NAV_LINKS) {
      await page.locator(`.nav-links a[href="${href}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${href.replace(".", "\\.")}$`));
      await expect(page.locator("h1")).toBeVisible();
      await page.goto("/index.html");
    }
  });

  test("mobile menu toggle opens navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/index.html");

    const navLinks = page.locator("#navLinks");
    await expect(navLinks).not.toHaveClass(/open/);

    await page.getByRole("button", { name: "Menu" }).click();
    await expect(navLinks).toHaveClass(/open/);
  });
});

test.describe("forms", () => {
  test("contact form renders expected inputs", async ({ page }) => {
    await page.goto("/contact.html");

    await expect(page.locator('form[name="contact"]')).toBeVisible();
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#phone")).toBeVisible();
    await expect(page.locator("#company")).toBeVisible();
    await expect(page.locator("#interest")).toBeVisible();
    await expect(page.locator("#message")).toBeVisible();
    await expect(page.getByRole("link", { name: "(510) 330-6457" })).toHaveAttribute(
      "href",
      "tel:+15103306457",
    );
  });

  test("careers application form renders and Apply Now pre-selects role", async ({ page }) => {
    await page.goto("/careers.html");

    await page.getByRole("link", { name: "Apply Now" }).first().click();
    await expect(page.locator("#apply")).toBeInViewport();

    const roleSelect = page.locator("#role");
    await expect(roleSelect).toHaveValue("Senior Salesforce Developer (JD-0084)");

    await expect(page.locator('form[name="job-application"]')).toBeVisible();
    await expect(page.locator("#resume")).toBeVisible();
  });
});

test.describe("content pages", () => {
  test("blog posts link back to resources", async ({ page }) => {
    for (const article of CONTENT_PAGES) {
      await page.goto(`/${article}`);
      const backLink = page.getByRole("link", { name: "← Back to Resources" });
      await expect(backLink).toBeVisible();
      await backLink.click();
      await expect(page).toHaveURL(/resources\.html$/);
    }
  });
});
