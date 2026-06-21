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
npm run dev        # Netlify Dev — includes /api/* routes for forms
```

Edit `templates/nav.html` for navigation changes, then run `npm run build`. Page metadata lives in `data/seo.json`.

Forms require `npm run dev` or the deployed site — they won't submit from static preview alone. Copy `.env.example` to `.env` for local API credentials.

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
