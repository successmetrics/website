# SuccessMetrics Website

Static marketing site for SuccessMetrics Corp (successmetrics.io). Plain HTML/CSS with a small nav build step.

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
├── templates/nav.html       # Shared primary navigation (single source of truth)
├── scripts/build-site.mjs   # Injects nav into every page before preview/deploy
├── docs/                    # Internal guides (not deployed)
├── tests/                   # Static + Playwright PR checks
├── .github/workflows/       # CI
├── netlify.toml             # Build command, publish dir, headers, clean URLs
└── package.json             # Build + test tooling
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

**Static checks** validate page structure, SEO meta tags (canonical, OG, Twitter, JSON-LD, sitemap, robots.txt), internal links, nav consistency, form/API wiring, email helper behavior, footer contact info, and design-token presence in CSS.

**E2E checks** load every page in Chromium, verify navigation, and submit contact/careers forms through the real UI (local test server with API handlers).

**Deployed form checks** (test branch only, needs `NETLIFY_SITE_URL`):

| Layer | Command | When it runs |
|---|---|---|
| Static | included in `npm run test:static` | Every PR — validates `netlify.toml`, form markup, honeypot, fields |
| Local browser forms | included in `npm run test:e2e` | Every PR — fills & submits contact + careers forms via UI |
| Deployed browser forms | `npm run test:netlify:e2e` | On `test` branch CI when `NETLIFY_SITE_URL` is set |
| Resend email | `npm run test:resend` | When `RESEND_API_KEY` GitHub secret is set |

Forms work locally via `npm run test:e2e` (uses `careers-test-server.mjs` with `/api/contact` + `/api/job-application`) and on the deployed Netlify site. To enable deployed form tests in CI on the **`test` branch**:

1. GitHub → **Settings → Secrets and variables → Actions → Variables**
2. Add `NETLIFY_SITE_URL` = `https://successmetrics.netlify.app`
3. Push to `test` (or open a PR targeting `test`) — the **Deployed form browser tests** job runs Playwright fill & submit against the live site.

```bash
npm run test:e2e
NETLIFY_SITE_URL=https://your-site.netlify.app npm run test:netlify:e2e
```

## Local preview

```bash
npm run preview
# runs npm run build, then serves site/ at http://localhost:8080
```

To change the primary nav, edit `templates/nav.html`, then run `npm run build`. Each page keeps a `<!-- @nav active="…" -->` marker so the build can set the active tab.

## Deploy (GitHub + Netlify)

1. Create a repo at github.com/new (e.g. `successmetrics-website`)
2. Push this folder (see commands below)
3. At app.netlify.com: **Add new site → Import an existing project → GitHub** → pick the repo → Deploy (`netlify.toml` sets `command = "npm run build"` and `publish = "site"`)
4. Every future `git push` auto-deploys in ~30 seconds

```bash
git remote add origin https://github.com/YOUR_USERNAME/successmetrics-website.git
git push -u origin main
```

## Custom domain

Netlify → Site settings → Domain management → Add `www.successmetrics.io`, then update the DNS records at your registrar as Netlify instructs. SSL is automatic.

## Form notifications (Resend)

Both the **contact** and **careers** forms send email notifications via **Resend** through Netlify Functions:

| Form | API route | Notify inbox env var |
|------|-----------|----------------------|
| Contact | `/api/contact` | `CONTACT_NOTIFY_EMAIL` (default: aditya@successmetrics.io) |
| Careers | `/api/job-application` | `CAREERS_NOTIFY_EMAIL` (default: aditya@successmetrics.io) |

Both forms send **from** `sduraisamy@successmetrics.io` via `RESEND_FROM_EMAIL` / `RESEND_CONTACT_FROM_EMAIL`.

Careers submissions are also saved to **Notion**. See [docs/NOTION-CAREERS-SETUP.md](./docs/NOTION-CAREERS-SETUP.md).

```bash
cp .env.example .env
npm run dev              # Netlify Dev — site + /api/contact + /api/jobs + /api/job-application
npm run verify:resend    # send test contact + careers emails
npm run test:resend      # live Resend API tests (needs RESEND_API_KEY in .env)
```

**Netlify environment variables:** `RESEND_API_KEY`, `CONTACT_NOTIFY_EMAIL`, `CAREERS_NOTIFY_EMAIL`, `RESEND_FROM_EMAIL`, `RESEND_CONTACT_FROM_EMAIL`

**GitHub Actions:** add `RESEND_API_KEY` as a repository secret and `CAREERS_NOTIFY_EMAIL` / `CONTACT_NOTIFY_EMAIL` as variables to enable the **Resend email notifications** CI job.

Spam protection via honeypot field is included on both forms. Forms only work on the deployed Netlify site (or `npm run dev`), not when opening HTML files locally.

## Editing with AI

This site is designed to be edited conversationally (Claude, Cursor, etc.):
- All design tokens (colors, fonts, spacing) are CSS variables at the top of `site/assets/css/styles.css`
- Primary navigation lives in `templates/nav.html` — run `npm run build` after editing
- New blog post = copy an existing file in `site/content/`, replace content, add a card in `site/resources.html`
