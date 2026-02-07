FROM node:lts-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Development stage
FROM base AS development

# Create non-root user for development
RUN adduser -D -u 1001 -s /bin/sh devuser

# Set working directory
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy packages (workspace dependencies)
COPY packages ./packages

# Copy admin app source
COPY apps/admin ./apps/admin

# Install dependencies
RUN pnpm install --filter admin...

# Change ownership to non-root user
RUN chown -R devuser:devuser /app

# Switch to non-root user
USER devuser

WORKDIR /app/apps/admin

# Start development server
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "80"]

# Build stage
FROM base AS builder
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy packages (workspace dependencies)
COPY packages ./packages

# Copy admin app source
COPY apps/admin ./apps/admin

# Install dependencies
RUN pnpm install --frozen-lockfile --filter admin...

WORKDIR /app
# 워크스페이스 패키지 먼저 빌드 (admin이 의존하는 패키지만)
RUN pnpm --filter @angple/types run build
RUN pnpm --filter @angple/i18n run build

WORKDIR /app/apps/admin
RUN pnpm run build

# Production stage
FROM caddy:2-alpine AS production

# Install dumb-init for proper signal handling
RUN apk update && apk add dumb-init

# Create non-root user
RUN adduser -D -u 1001 -s /bin/sh caddyadmin
RUN chown -R caddyadmin:caddyadmin /config/caddy /data/caddy

# Set working directory
WORKDIR /app

COPY --chown=caddyadmin:caddyadmin apps/admin/Caddyfile /etc/caddy/Caddyfile

# Copy built application from builder
COPY --from=builder --chown=caddyadmin:caddyadmin /app/apps/admin/build ./build

# Switch to non-root user
USER caddyadmin

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:80/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
