# SuccessMetrics Website

Static marketing site for [successmetrics.io](https://www.successmetrics.io). Plain HTML/CSS with a small Node build step for shared navigation, SEO metadata, and success story pages. Deployed on Netlify with serverless functions for contact and careers forms.

## Repository layout

```
├── site/                    # Deployable static site (Netlify publish root)
│   ├── *.html               # Main pages (/services, /careers, … via clean URLs)
│   ├── assets/css/styles.css
│   ├── assets/js/
│   └── content/             # Blog posts, white papers, success stories
├── templates/nav.html       # Shared primary navigation
├── data/seo.json            # Page titles, meta descriptions, sitemap config
├── scripts/build-site.mjs   # Build: nav, SEO, sitemap, success stories
├── netlify/functions/       # Contact, careers, and job listing APIs
├── tests/                   # Static checks + Playwright smoke tests
└── netlify.toml
```

Main pages: Home, Services, Industries, Accelerators, Resources, Success Stories, Careers, About, Contact.

## Local development

```bash
npm ci
npm run preview    # build + serve site/ at http://localhost:8080
npx netlify-cli dev # full local site, including /api/* routes
```

Edit `templates/nav.html` for navigation changes, then run `npm run build`. Page metadata lives in `data/seo.json`.

Forms require `npx netlify-cli dev` or the deployed site — they won't submit from static preview alone. Copy `.env.example` to `.env` for local API credentials.

## Review the `test` branch on another computer

Prerequisites:

- Git
- Node.js 20 or newer
- Access to this GitHub repository

Clone the repository and check out the `test` branch:

```bash
git clone <repository-url>
cd website
git checkout test
git pull origin test
npm ci
npx netlify-cli dev
```

Open the local URL printed by Netlify CLI, normally:

```text
http://localhost:8888
```

For visual review only, no `.env` file is required. Forms and integrations require environment variables:

```bash
cp .env.example .env
```

Populate `.env` only with credentials provided through a secure channel. Never commit `.env`, API keys, service-account JSON, or other secrets.

To refresh an existing checkout after more changes are pushed:

```bash
git checkout test
git pull origin test
npm ci
npx netlify-cli dev
```

`localhost` is accessible only on the computer running the command. Pushing to GitHub does not create a public preview by itself. For review through a browser without cloning the repository, use the Netlify branch-deploy URL for the `test` branch.

## Testing

```bash
npm test              # static + e2e
npm run test:static   # HTML, links, SEO, form markup
npm run test:e2e      # browser smoke tests (run `npx playwright install chromium` once)
```

CI runs these on pull requests via GitHub Actions.

## Deploy

Netlify builds on push (`npm run build`, publish `site/`). See `netlify.toml` for clean URLs, headers, and API redirects.

## Forms & integrations

Contact and careers forms post to Netlify Functions. Notifications go out via Resend; careers applications are also stored in Notion. Required environment variables are listed in `.env.example`.

## Editing content

- **Styles** — CSS variables at the top of `site/assets/css/styles.css`
- **Nav** — `templates/nav.html`, then `npm run build`
- **SEO** — `data/seo.json`, then `npm run build`
- **Blog / white paper** — copy an existing file in `site/content/`, add a card in `site/resources.html`
- **Success story** — add Markdown under `site/content/success-stories/`, run `npm run build`
