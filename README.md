# Solaria VC

Marketing site for Solaria VC — a student-led venture club and LLC.

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
- nginx 1.27 (alpine) for serving in production

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
