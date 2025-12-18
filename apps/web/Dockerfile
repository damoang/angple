FROM node:lts-alpine3.22 AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Development stage
FROM base AS development

# Create non-root user for development
RUN adduser -D -u 1001 -s /bin/sh devuser

# Set working directory to web app
WORKDIR /app/apps/web

# Copy source code
COPY apps/web .

# Install dependencies
RUN pnpm install

# Change ownership to non-root user
RUN chown -R devuser:devuser /app

# Switch to non-root user
USER devuser

# Start development server
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "80"]

# Build stage
FROM base AS builder

# Set working directory
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy application source
COPY apps/web ./apps/web

# Build the application
RUN pnpm install --frozen-lockfile --filter web
RUN pnpm --filter web run build

# Production stage
FROM caddy:2.10-alpine AS production

# Install dumb-init for proper signal handling
RUN apk update && apk add dumb-init

# Create non-root user
RUN adduser -D -u 1001 -s /bin/sh caddyweb
RUN chown -R caddyweb:caddyweb /config/caddy /data/caddy

# Set working directory
WORKDIR /app

COPY --chown=caddyweb:caddyweb apps/web/Caddyfile /etc/caddy/Caddyfile

# Copy built application from builder
COPY --from=builder --chown=caddyweb:caddyweb /app/apps/web/build ./build

# Switch to non-root user
USER caddyweb

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:80/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
