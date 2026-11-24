# The live website image (solariavc-portal-fix-20261124-6) plus what search engines read:
# real 404s for addresses that don't exist, a sitemap that dates itself, www -> solariavc.com, noindex on the
# service's own *.run.app addresses, and one description of the company in the home page's head.
FROM europe-west1-docker.pkg.dev/gen-lang-client-0188652481/cloud-run-source-deploy/solariavc/team-login@sha256:8ae049a8e3254f21aeca28438477677989104f7a744c80fbe428e1aebaed0d30
COPY app/server/index.js /app/server/index.js
COPY app/dist/index.html app/dist/404.html app/dist/robots.txt /app/dist/
COPY app/dist/research/solaria-family-model-m5v3.html /app/dist/research/
