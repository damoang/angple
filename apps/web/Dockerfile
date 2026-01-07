FROM node:lts-alpine3.22 AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# -----------------------------
# Development stage
# -----------------------------
FROM base AS development

# Create non-root user for development
RUN adduser -D -u 1001 -s /bin/sh devuser

# Set working directory
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy packages (workspace dependencies)
COPY packages ./packages

# Copy themes (for $themes alias)
COPY themes ./themes

# Copy web app source
COPY apps/web ./apps/web

# Install dependencies
RUN pnpm install --filter web...

# Change ownership to non-root user
RUN chown -R devuser:devuser /app

# Switch to non-root user
USER devuser

WORKDIR /app/apps/web

# Start development server
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "3000"]

# -----------------------------
# Build stage
# -----------------------------
FROM base AS builder

# Set working directory
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy workspace packages (workspace:* dependencies)
COPY packages ./packages

# Copy themes (for $themes alias in vite.config.ts)
COPY themes ./themes

# Copy application source
COPY apps/web ./apps/web

# Install dependencies and build
RUN pnpm install --frozen-lockfile --filter web...
RUN pnpm --filter web run build

# Deploy as standalone package (resolves workspace:* dependencies)
# --legacy: pnpm v10에서 inject-workspace-packages 없이 deploy 허용
RUN pnpm --filter web deploy /app/deploy --prod --legacy

# Copy build output to deploy directory
RUN cp -r /app/apps/web/build /app/deploy/build

# -----------------------------
# Production stage (SSR Node.js)
# -----------------------------
FROM node:lts-alpine3.22 AS production

# Create non-root user
RUN adduser -D -u 1001 -s /bin/sh nodeuser

WORKDIR /app

# Copy deployed standalone package from builder
COPY --from=builder --chown=nodeuser:nodeuser /app/deploy ./

# Copy themes for runtime (theme scanner needs this)
COPY --from=builder --chown=nodeuser:nodeuser /app/themes ./themes

# Create data directory for settings
RUN mkdir -p /app/data && chown nodeuser:nodeuser /app/data

# Switch to non-root user
USER nodeuser

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

# Start the application
CMD ["node", "build"]
