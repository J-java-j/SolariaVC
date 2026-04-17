# syntax=docker/dockerfile:1.6

# ---- Build stage: compile the React app ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage: tiny Node server ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Server has zero npm dependencies — uses only built-in Node modules
# (http, fs, path, url, global fetch in Node 18+). Just copy the built
# assets and the server entry point.
COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 8080
USER node
CMD ["node", "server/index.js"]
