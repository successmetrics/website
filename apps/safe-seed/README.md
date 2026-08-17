# Safe-Seed demo (website mount)

Copied from the Synthetic-Data repo `web/` app. Hosted on the marketing site at `/demo`.

Production build is `VITE_API_BASE=/demo/api`. The website Netlify function at `/demo/api/*` proxies to the Hugging Face Space and injects `HF_TOKEN`. Do not put a Hugging Face token in this folder.

```bash
npm ci
VITE_API_BASE=/demo/api npm run build
```
