FROM node:20-alpine AS base

# Use HTTP mirrors to avoid corporate TLS inspection issues
RUN echo "http://dl-cdn.alpinelinux.org/alpine/v3.21/main" > /etc/apk/repositories && \
  echo "http://dl-cdn.alpinelinux.org/alpine/v3.21/community" >> /etc/apk/repositories

# Install system dependencies for Puppeteer (Chromium) and sharp
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  python3 \
  make \
  g++

# Tell Puppeteer to skip downloading Chromium (use system install)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_BIN=/usr/bin/chromium-browser

# =============================================
# Stage 1: Install dependencies
# =============================================
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production --ignore-scripts && \
  npm ci --ignore-scripts

# =============================================
# Stage 2: Build
# =============================================
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# =============================================
# Stage 3: Production image
# =============================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/config ./config

# Create temp directory with proper permissions
RUN mkdir -p /tmp/hr-sessions && chown nextjs:nodejs /tmp/hr-sessions

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
