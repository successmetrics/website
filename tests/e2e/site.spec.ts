import { test, expect } from "@playwright/test";

const MAIN_PAGES = [
  "index.html",
  "services.html",
  "industries.html",
  "accelerators.html",
  "resources.html",
  "ai-research.html",
  "success-stories.html",
  "careers.html",
  "about.html",
  "contact.html",
];

const CONTENT_PAGES = [
  "content/blog-ai-enabled-delivery.html",
  "content/blog-midmarket-salesforce.html",
  "content/blog-lpi-accelerator.html",
  "content/whitepaper-midmarket-guide.html",
  "content/ai-research/off-grid-ai-lab-patient-trial-matching.html",
  "content/success-stories/amp-customer-portal-success-story.html",
  "content/success-stories/caloes-ppe-portal-success-story.html",
  "content/success-stories/leaflink-cpq-success-story.html",
  "content/success-stories/sfhss-agentforce-success-story.html",
  "content/success-stories/mohcd-agentforce-success-story.html",
  "careers/senior-salesforce-developer-0084.html",
  "careers/salesforce-architect-0082.html",
  "careers/salesforce-developer-0081.html",
];

const NAV_LINKS = [
  { href: "/services.html" },
  { href: "/industries.html" },
  { href: "/accelerators.html" },
  { href: "/resources.html" },
  { href: "/ai-research.html" },
  { href: "/success-stories.html" },
  { href: "/careers.html" },
  { href: "/about.html" },
  { href: "/contact.html" },
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
    await expect(page.locator("#client-marquee-title")).toHaveText("Our Clients");
    await expect(page.locator(".client-marquee")).toBeVisible();
    await expect(page.locator('.client-logo img[alt="Cal OES"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="Alameda Municipal Power"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="Roller Software"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="Caltrans"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="RLI"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="LeafLink"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="San Francisco Health Service System"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="Mayor’s Office of Housing and Community Development"]')).toBeVisible();
    await expect(page.locator('.client-logo img[alt="RPM"]')).toHaveCount(0);
  });

  test("client marquee logos stay in a horizontal row", async ({ page }) => {
    await page.goto("/index.html");

    const tops = await page
      .locator(".client-marquee-group:first-child .client-logo")
      .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().top));

    expect(tops.length).toBeGreaterThan(1);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(8);
  });

  test("success stories cards render styled thumbnails", async ({ page }) => {
    await page.goto("/success-stories.html");

    const thumb = page.locator(".story-card .story-card-thumb").first();
    await expect(thumb).toBeVisible();

    const height = await thumb.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(240);
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
      await expect(page).toHaveURL(new RegExp(`${href.replace(/\//g, "\\/").replace(".", "\\.")}$`));
      await expect(page.locator("h1")).toBeVisible();
      await page.goto("/index.html");
    }
  });

  test("tablet nav menu shows Success Stories on resources and careers", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    for (const pagePath of ["resources.html", "careers.html"]) {
      await page.goto(`/${pagePath}`);
      await page.getByRole("button", { name: "Menu" }).click();
      const successStories = page.locator(".nav-links").getByRole("link", { name: "Success Stories" });
      await expect(successStories).toBeVisible();
      await successStories.click();
      await expect(page).toHaveURL(/success-stories\.html$/);
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

  for (const pagePath of ALL_PAGES) {
    test(`${pagePath} shows Success Stories in the primary nav`, async ({ page }) => {
      await page.goto(`/${pagePath}`);
      await expect(page.locator(".nav-links").getByRole("link", { name: "Success Stories" })).toBeVisible();
    });
  }
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

  test("forms fit within mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const pagePath of ["contact.html", "careers.html"]) {
      await page.goto(`/${pagePath}`);

      const form = page.locator(".form-card").first();
      const box = await form.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(391);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hasHorizontalOverflow, `Horizontal overflow on ${pagePath}`).toBe(false);
    }
  });

  test("careers application form renders and Apply Now pre-selects role", async ({ page }) => {
    await page.goto("/careers.html");

    await expect(page.locator("#job-list .job-row")).toHaveCount(3);

    const firstMoreInfo = page.getByRole("link", { name: "More info" }).first();
    await expect(firstMoreInfo).toBeVisible();

    const firstApply = page.getByRole("button", { name: "Apply Now" }).first();
    const expectedRole = await firstApply.getAttribute("data-role");
    expect(expectedRole).toBeTruthy();

    await firstApply.click();
    await expect(page.locator("#apply")).toBeInViewport();

    const roleSelect = page.locator("#role");
    await expect(roleSelect).toHaveValue(expectedRole!);

    await expect(page.locator("#job-application-form")).toBeVisible();
    await expect(page.locator("#resume")).toBeVisible();

    await firstMoreInfo.click();
    await expect(page).toHaveURL(/\/careers\/[^/]+$/);
    await expect(page.locator(".job-detail-content")).toBeVisible();
  });
});

test.describe("content pages", () => {
  test("blog posts link back to resources", async ({ page }) => {
    const articles = [
      "content/blog-ai-enabled-delivery.html",
      "content/blog-midmarket-salesforce.html",
      "content/blog-lpi-accelerator.html",
      "content/whitepaper-midmarket-guide.html",
    ];

    for (const article of articles) {
      await page.goto(`/${article}`);
      const backLink = page
        .getByLabel("Article navigation")
        .getByRole("link", { name: "← Back to Resources" });
      await expect(backLink).toBeVisible();
      await backLink.click();
      await expect(page).toHaveURL(/resources\.html$/);
    }
  });

  test("success stories link back to success stories index", async ({ page }) => {
    const stories = [
      "content/success-stories/sfhss-agentforce-success-story.html",
      "content/success-stories/mohcd-agentforce-success-story.html",
    ];

    for (const story of stories) {
      await page.goto(`/${story}`);
      const backLink = page
        .getByLabel("Story navigation")
        .getByRole("link", { name: "← Back to Success Stories" });
      await expect(backLink).toBeVisible();
      await backLink.click();
      await expect(page).toHaveURL(/success-stories\.html$/);
    }
  });
});
