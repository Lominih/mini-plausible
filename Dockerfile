# ---- Build Stage ----
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source and build
COPY src ./src/
RUN npm run build

# ---- Production Stage ----
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl dumb-init && rm -rf /var/lib/apt/lists/*

# Copy package files and install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy Prisma schema, generated client, and migrations
COPY prisma ./prisma/

# Copy built JS
COPY --from=builder /app/dist ./dist

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Run as non-root
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 nextjs

USER nextjs

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]