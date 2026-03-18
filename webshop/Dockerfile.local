# ═══════════════════════════════════════════════
# WEBSHOP — Dockerfile (Multi-stage)
# ═══════════════════════════════════════════════

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDeps for tsc + prisma generate)
COPY package*.json ./
RUN npm ci

# Copy Prisma schema first so client can be generated
COPY prisma/ ./prisma/
RUN npx prisma generate

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY backend/      ./backend/
RUN npx tsc

# Stage 2: Production runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy Prisma schema and generated client
COPY prisma/ ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Create uploads directory for media files
RUN mkdir -p /app/uploads

# Non-root user for security
RUN addgroup -S webshop && adduser -S webshop -G webshop \
    && chown -R webshop:webshop /app/uploads
USER webshop

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/backend/server.js"]

