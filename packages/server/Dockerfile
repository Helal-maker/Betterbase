FROM oven/bun:1.3.9-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

# Copy monorepo structure (only what server needs)
COPY package.json turbo.json bun.lock ./
COPY packages/server/package.json ./packages/server/
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

COPY packages/server ./packages/server
COPY packages/core ./packages/core
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

RUN cd packages/server && bun build src/index.ts --outdir dist --target bun

# --- Runtime stage ---
FROM oven/bun:1.3.9-alpine

WORKDIR /app

RUN apk add --no-cache wget=1.25.0-r1

COPY --from=builder /app/packages/server/dist ./dist

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["bun", "dist/index.js"]