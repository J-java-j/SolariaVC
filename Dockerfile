# syntax=docker/dockerfile:1.6

# ---- Build stage: compile the React app ----
FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.html sign.html staff.html vite.config.ts tsconfig*.json tailwind.config.js postcss.config.js ./
COPY src ./src
COPY public ./public
COPY server/team-access.* ./server/
COPY staff-service/destinations.json ./staff-service/
ARG VITE_TEAM_PORTAL_ENABLED=false
ARG VITE_TEAM_FIREBASE_API_KEY
ARG VITE_TEAM_FIREBASE_TENANT
RUN test "$VITE_TEAM_PORTAL_ENABLED" = false || (test "$VITE_TEAM_PORTAL_ENABLED" = true && test -n "$VITE_TEAM_FIREBASE_API_KEY" && test -n "$VITE_TEAM_FIREBASE_TENANT")
RUN npm run build

# ---- Runtime stage: Node server ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# The marketing routes use only built-in Node modules. Solaria Sign needs
# pdf-lib and the Firestore and Cloud Storage clients, which authenticate
# as the Cloud Run service identity rather than with a key file.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY staff-service/package*.json ./staff-service/
RUN npm ci --prefix staff-service --omit=dev && npm cache clean --force
COPY staff-service/owner-setup.js staff-service/api.js staff-service/provider.js staff-service/invitations.js staff-service/session.js staff-service/terminal-handoff.js staff-service/hosted-terminal.js staff-service/verifier.js staff-service/destinations.json ./staff-service/
ARG VITE_TEAM_PORTAL_ENABLED=false
ARG VITE_TEAM_FIREBASE_API_KEY
ENV TEAM_BROWSER_API_KEY=$VITE_TEAM_FIREBASE_API_KEY
ENV TEAM_PORTAL_ENABLED=$VITE_TEAM_PORTAL_ENABLED

# ZIP build contexts can supply owner-only modes. The server runs as node.
RUN chmod a+r package*.json staff-service/*.json staff-service/*.js && chmod -R a+rX server dist

EXPOSE 8080
USER node
CMD ["node", "server/index.js"]
