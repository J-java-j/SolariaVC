# The live website image (solariavc-portal-fix-20261124-5) plus page files only:
# Solaria Sign's "Sign all" page (boxes that grow as you type; the answer shown fitted on the document), built from
# the repository at 7c07a40 plus sign-all.diff, and the Team Portal's recovery button label ("Requesting…").
FROM europe-west1-docker.pkg.dev/gen-lang-client-0188652481/cloud-run-source-deploy/solariavc/team-login@sha256:76e29b20db1e4c3bbec4a3ab8d94e1db42b28c7939e0c6bae74753dbc2541758
COPY app/dist/sign.html app/dist/staff.html /app/dist/
COPY app/dist/assets/sign-BkD4rtCl.js app/dist/assets/sign-DDl034i8.css app/dist/assets/staff-Fast02.js app/dist/assets/ConnectedPortal-Fast02.js /app/dist/assets/
