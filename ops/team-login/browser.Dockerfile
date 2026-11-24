FROM node:24-bookworm-slim
WORKDIR /review
COPY staff-service/package*.json ./
RUN npm ci --no-audit --no-fund
RUN ./node_modules/.bin/playwright-core install --with-deps chromium
COPY staff-service/terminal-browser.test.js staff-service/fixtures.js staff-service/provider.js staff-service/invitations.js ./
CMD ["node", "--test", "terminal-browser.test.js"]
