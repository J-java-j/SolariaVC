# syntax=docker/dockerfile:1.6

# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.27-alpine AS runtime

# Cloud Run injects PORT (default 8080). nginx config uses ${PORT}.
ENV PORT=8080

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# nginx:alpine entrypoint runs envsubst on /etc/nginx/templates/*.template
# automatically before starting nginx.
CMD ["nginx", "-g", "daemon off;"]
