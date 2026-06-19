# SuccessMetrics Website

Static marketing site for SuccessMetrics Corp (successmetrics.io). Plain HTML/CSS — no build step.

## Repository layout

```
├── site/                    # Deployable static site (Netlify publish root)
│   ├── index.html           # Main pages (flat URLs: /services, /careers, …)
│   ├── services.html
│   ├── …
│   ├── assets/
│   │   ├── css/styles.css   # Design tokens + shared styles
│   │   └── images/logo.svg
│   └── content/             # Blog posts & white papers
│       ├── blog-*.html
│       └── whitepaper-*.html
├── docs/                    # Internal guides (not deployed)
├── tests/                   # Static + Playwright PR checks
├── .github/workflows/       # CI
├── netlify.toml             # Publish dir, headers, clean URLs, legacy redirects
└── package.json             # Test tooling only
```

| Path | Purpose |
|---|---|
| `site/index.html` | Homepage |
| `site/services.html` | Services |
| `site/industries.html` | Industries |
| `site/accelerators.html` | Accelerators |
| `site/resources.html` | Blog & white paper index |
| `site/content/blog-*.html` | Blog articles |
| `site/content/whitepaper-*.html` | White papers |
| `site/careers.html` | Job listings + application form |
| `site/about.html`, `site/contact.html` | Company & contact |

## Testing (PR checks)

Static analysis and browser smoke tests run on every pull request via GitHub Actions (`.github/workflows/site-tests.yml`).

```bash
npm ci
npm test                 # static + e2e
npm run test:static      # fast HTML/link/form checks (Vitest)
npm run test:e2e         # browser smoke tests (Playwright; run `npx playwright install chromium` once locally)
```

**Static checks** validate page structure, SEO meta tags, internal links, nav consistency, Netlify form wiring, footer contact info, and design-token presence in CSS.

**E2E checks** load every page in Chromium, verify navigation, forms, and key homepage content.

**Netlify checks** (two layers):

| Layer | Command | When it runs |
|---|---|---|
| Static | included in `npm run test:static` | Every PR — validates `netlify.toml`, form markup, honeypot, fields |
| Live submissions | `npm run test:netlify` | On `test` branch CI when `NETLIFY_SITE_URL` is set |
| Live browser | `npm run test:netlify:e2e` | On `test` branch CI when `NETLIFY_SITE_URL` is set |

Forms only work on the deployed Netlify site (not local preview). To enable live form tests in CI on the **`test` branch**:

1. GitHub → **Settings → Secrets and variables → Actions → Variables**
2. Add `NETLIFY_SITE_URL` = `https://successmetrics.netlify.app`
3. Push to `test` (or open a PR targeting `test`) — two extra jobs run:
   - **Netlify form submissions** (POST tests for contact + careers)
   - **Netlify form browser tests** (Playwright fill & submit)

Static Netlify markup checks (`netlify.toml`, form HTML) already run on every branch via `npm run test:static`.

Submissions appear in [Netlify Forms](https://app.netlify.com/projects/successmetrics/forms) (tagged with `ci-` / `Automated` — safe to delete).

```bash
NETLIFY_SITE_URL=https://your-site.netlify.app npm run test:netlify
NETLIFY_SITE_URL=https://your-site.netlify.app npm run test:netlify:e2e
```

## Local preview

```bash
python3 -m http.server 8080 --directory site
# → http://localhost:8080
```

## Deploy (GitHub + Netlify)

1. Create a repo at github.com/new (e.g. `successmetrics-website`)
2. Push this folder (see commands below)
3. At app.netlify.com: **Add new site → Import an existing project → GitHub** → pick the repo → Deploy (no build settings needed; `netlify.toml` sets `publish = "site"`)
4. Every future `git push` auto-deploys in ~30 seconds

```bash
git remote add origin https://github.com/YOUR_USERNAME/successmetrics-website.git
git push -u origin main
```

## Custom domain

Netlify → Site settings → Domain management → Add `www.successmetrics.io`, then update the DNS records at your registrar as Netlify instructs. SSL is automatic.

## Forms (Netlify Forms — already wired up)

Both forms (`job-application` in `site/careers.html`, `contact` in `site/contact.html`) use [Netlify Forms](https://docs.netlify.com/forms/setup/). After the first deploy:

1. [Netlify Forms dashboard](https://app.netlify.com/projects/successmetrics/forms) — submissions (including resume uploads, 8 MB max) appear here
2. **Site settings → Forms → Form notifications** — add email notifications (e.g. careers@successmetrics.io and support@successmetrics.io)

Spam protection via honeypot field is included. Note: forms only work on the deployed Netlify site, not when opening files locally.

## Editing with AI

This site is designed to be edited conversationally (Claude, Cursor, etc.):
- All design tokens (colors, fonts, spacing) are CSS variables at the top of `site/assets/css/styles.css`
- Each page is self-contained; nav/footer are repeated per page — ask the AI to "update the nav on all pages" when changing menus
- New blog post = copy an existing file in `site/content/`, replace content, add a card in `site/resources.html`
