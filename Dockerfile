# syntax=docker/dockerfile:1.6

# ---- Build stage: compile the React app ----
FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage: Node server with the Firestore client ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Install locked production dependencies, including the official Firestore SDK.
# Authentication uses the Cloud Run service identity, not a JSON key file.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 8080
USER node
CMD ["node", "server/index.js"]
