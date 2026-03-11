# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (separate layer for caching)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and build TypeScript
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm run build
RUN npx prisma generate

# ── Stage 2: Production image ──────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built artifacts and generated Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY prisma ./prisma

# Non-root user for security
RUN addgroup -S surework && adduser -S api -G surework
USER api

EXPOSE 3000

# Migrate DB then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
