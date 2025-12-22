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

# -----------------------------
# Build stage
# -----------------------------
FROM base AS builder

# Set working directory
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy application source
COPY apps/web ./apps/web

# Install dependencies and build
RUN pnpm install --frozen-lockfile --filter web
RUN pnpm --filter web run build

# -----------------------------
# Production stage (SSR Node.js)
# -----------------------------
FROM base AS production

# Create non-root user
RUN adduser -D -u 1001 -s /bin/sh nodeuser

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nodeuser:nodeuser /app/apps/web/build ./build
COPY --from=builder --chown=nodeuser:nodeuser /app/apps/web/package.json ./package.json

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

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
