# syntax=docker/dockerfile:1

############################
# Builder
############################
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install all deps (layer cached unless the lockfile changes)
COPY package.json package-lock.json ./
RUN npm ci

# Generate Prisma client + compile TypeScript
COPY . .
RUN npx prisma generate && npm run build

############################
# Runner
############################
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# tini  -> proper PID 1, reaps the Chromium zombies Puppeteer spawns
# chromium + libs -> required by Puppeteer (we skip its bundled download below)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Runtime artifacts. node_modules is copied whole because the prod start
# command runs `npx prisma db push`, which needs the Prisma CLI at runtime.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Ensure these exist even before the prod bind-mounts attach
RUN mkdir -p uploads src/assets config

EXPOSE 3000

# tini as the entrypoint so Chromium child processes are reaped cleanly
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "run", "start:prod"]
