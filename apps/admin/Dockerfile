FROM node:lts-alpine3.22 AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Development stage
FROM base AS development

# Set working directory to admin app
WORKDIR /app/apps/admin

# Copy source code
COPY apps/admin .

# Install dependencies
RUN pnpm install

# Start development server
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "80"]

# Build stage
FROM base AS builder

# Set working directory
WORKDIR /app

# Copy application source
COPY apps/admin .

# Build the application
RUN pnpm install --frozen-lockfile
RUN pnpm run build

# Production stage
FROM caddy:2.10-alpine AS production

# Install dumb-init for proper signal handling
RUN apk update && apk add dumb-init

# Create non-root user
RUN adduser -D -u 1001 -s /bin/sh caddyadmin
RUN chown -R caddyadmin:caddyadmin /config/caddy /data/caddy

# Set working directory
WORKDIR /app

COPY --chown=caddyadmin:caddyadmin apps/admin/Caddyfile /etc/caddy/Caddyfile

# Copy built application from builder
COPY --from=builder --chown=caddyadmin:caddyadmin /app/build ./build

# Switch to non-root user
USER caddyadmin

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:80/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
