# SuccessMetrics Website

Static marketing site for SuccessMetrics Corp (successmetrics.io). Plain HTML/CSS — no build step, no dependencies.

## Structure

| File | Page |
|---|---|
| `index.html` | Homepage |
| `services.html` | Services (advisory, roadmap, implementation, managed) |
| `industries.html` | Tech, Healthcare, FinServ, State & Local Gov, Nonprofit |
| `accelerators.html` | LPI, LWC Library, Org Insights, Data Masking, Nonprofit |
| `resources.html` | Blog & white paper index |
| `blog-*.html` | Blog articles |
| `whitepaper-*.html` | White papers |
| `careers.html` | Job listings + application form |
| `about.html`, `contact.html` | Company & contact |
| `styles.css` | Single shared stylesheet (design tokens at top) |
| `netlify.toml` | Netlify config: headers + clean URLs |

## Deploy (GitHub + Netlify)

1. Create a repo at github.com/new (e.g. `successmetrics-website`)
2. Push this folder (see commands below)
3. At app.netlify.com: **Add new site → Import an existing project → GitHub** → pick the repo → Deploy (no build settings needed)
4. Every future `git push` auto-deploys in ~30 seconds

```bash
git remote add origin https://github.com/YOUR_USERNAME/successmetrics-website.git
git push -u origin main
```

## Custom domain

Netlify → Site settings → Domain management → Add `www.successmetrics.io`, then update the DNS records at your registrar as Netlify instructs. SSL is automatic.

## Forms (Netlify Forms — already wired up)

Both forms (`job-application` in careers.html, `contact` in contact.html) use [Netlify Forms](https://docs.netlify.com/forms/setup/). After the first deploy:

1. Netlify dashboard → your site → **Forms** — submissions (including resume uploads, 8 MB max) appear here
2. **Site settings → Forms → Form notifications** — add email notifications (e.g. careers@successmetrics.io and support@successmetrics.io)

Spam protection via honeypot field is included. Note: forms only work on the deployed Netlify site, not when opening files locally.

## Editing with AI

This site is designed to be edited conversationally (Claude, Cursor, etc.):
- All design tokens (colors, fonts, spacing) are CSS variables at the top of `styles.css`
- Each page is self-contained; nav/footer are repeated per page — ask the AI to "update the nav on all pages" when changing menus
- New blog post = copy an existing `blog-*.html`, replace content, add a card in `resources.html`
