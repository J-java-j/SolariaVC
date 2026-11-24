# Daniel's live website image (solariavc-00133-pk4) plus the 2026-11-24 portal patch:
# a 10-second sign-in memory for page reads, and the sign-in page's recovery link.
FROM europe-west1-docker.pkg.dev/gen-lang-client-0188652481/cloud-run-source-deploy/solariavc/team-login@sha256:c93c17533645f620f7c083ac96c976a037ca8ed8fe409b4bc21899dccd36b0ea
COPY app/staff-service/hosted-terminal.js app/staff-service/api.js /app/staff-service/
COPY app/dist/staff.html /app/dist/staff.html
COPY app/dist/assets/staff-RcvLnk01.js app/dist/assets/ConnectedPortal-RcvLnk01.js /app/dist/assets/
