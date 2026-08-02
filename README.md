# Solaria Capital

Marketing site for Solaria Capital — a privately held investment firm
operating the Medallion Fund, Solaria Ventures, and Solaria Research.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Production build

```bash
npm run build
npm run preview
```

## Deploy to Google Cloud Run

The repo ships with a multi-stage `Dockerfile` and an nginx config that
honors Cloud Run's `$PORT` env var.

If you've already connected this GitHub repo to a Cloud Run service via the
Cloud Console (Cloud Run → "Continuously deploy from a repository"), every
push to `main` will:

1. Trigger Cloud Build
2. Build the image from this `Dockerfile`
3. Deploy a new revision to your Cloud Run service

To deploy manually instead:

```bash
gcloud run deploy solaria-vc \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### Local Docker test

```bash
docker build -t solaria-vc .
docker run --rm -p 8080:8080 -e PORT=8080 solaria-vc
# open http://localhost:8080
```

## Tech

- Vite + React 18 + TypeScript
- Tailwind CSS 3
- Node 20 server (`server/index.js`, zero npm deps) that:
  - Serves the built static app from `dist/`
  - Proxies `/api/quotes` to Stooq (with Yahoo Finance fallback) for real
    equity + index prices
  - Proxies `/api/crypto` to CoinGecko for BTC/ETH
  - Handles `POST /api/contact` — validates, honeypots, rate-limits,
    and emails the partner inbox via Resend
  - Caches responses in-memory (15–60s TTL)

## Enabling the contact form (one-time, ~2 minutes)

The contact form posts to `POST /api/contact`, which emails
`contact@solariavc.com` via Resend. Delivery requires an API key:

1. Sign up at https://resend.com (free, no domain required).
2. Create an API key (Dashboard → API Keys → Create).
3. **Production (Cloud Run):** Edit & deploy a new revision →
   **Variables & Secrets**, add:
   - `RESEND_API_KEY` = `re_xxxxxxxxxxxx` (required)
   - optional: `CONTACT_FROM_EMAIL` = `Solaria Capital <onboarding@resend.dev>`
   - remove any old `CONTACT_TO_EMAIL` if present (recipient is hardcoded to
     `contact@solariavc.com`)
4. **Local:** copy `.env.example` → `.env`, set `RESEND_API_KEY`, then run
   `npm run server` (and `npm run dev` for the Vite UI; `/api` is proxied).
5. Deploy. Submissions arrive as formatted email with Reply-To set to the
   sender.

Resend's free tier includes 3,000 emails/month and uses
`onboarding@resend.dev` as the sender by default — no domain
verification needed. To send from `@solariavc.com`, verify the domain
in Resend and set `CONTACT_FROM_EMAIL` accordingly.

## Structure

```
src/
  App.tsx                # composition
  main.tsx               # entry
  styles.css             # tailwind + design tokens
  components/
    Nav.tsx
    Hero.tsx
    Marquee.tsx
    About.tsx
    Thesis.tsx
    Portfolio.tsx
    Team.tsx
    Apply.tsx
    Footer.tsx
public/favicon.svg
Dockerfile
nginx.conf.template
```
