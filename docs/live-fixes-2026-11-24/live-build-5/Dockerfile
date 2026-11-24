# The live website image (solariavc-portal-fix-20261124-4) plus two server files:
# TEAM_SIGN_GATE=off takes the Team Portal check off Solaria Sign (its emailed-link sign-in looped), and a "*"
# entry in TEAM_INVITE_EMAILS lets the Owner and Board Admins add a portal account at any address.
FROM europe-west1-docker.pkg.dev/gen-lang-client-0188652481/cloud-run-source-deploy/solariavc/team-login@sha256:2e3302015cf376ff963e30bd6a3710106fe7df6a2eb6199a9fc4cefd1341b881
COPY app/server/team-access.mjs /app/server/team-access.mjs
COPY app/staff-service/provider.js /app/staff-service/provider.js
