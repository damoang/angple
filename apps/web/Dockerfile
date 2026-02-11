FROM node:lts-alpine AS base

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

# 개발 서버 포트 (환경 변수로 제어 가능)
ARG DEV_PORT=3010
ENV DEV_PORT=$DEV_PORT

# Start development server
CMD ["sh", "-c", "pnpm dev --host 0.0.0.0 --port $DEV_PORT"]

# -----------------------------
# Build stage
# -----------------------------
FROM base AS builder

# Build arguments for Vite environment variables
ARG VITE_USE_MOCK=false
ARG VITE_SSR=true
ENV VITE_USE_MOCK=$VITE_USE_MOCK
ENV VITE_SSR=$VITE_SSR

# Set working directory
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy workspace packages (workspace:* dependencies)
COPY packages ./packages

# Copy application source
COPY apps/web ./apps/web

# Install dependencies first
RUN pnpm install --frozen-lockfile --filter web...

# Copy themes/plugins/widgets AFTER install so they can access node_modules
COPY themes ./themes
COPY plugins ./plugins
COPY widgets ./widgets
# 워크스페이스 패키지 먼저 빌드 (의존성 순서대로)
RUN pnpm --filter @angple/types run build
RUN pnpm --filter @angple/i18n run build
RUN pnpm --filter @angple/hook-system run build
RUN pnpm --filter @angple/theme-engine run build
RUN pnpm --filter web run build

# Deploy as standalone package (resolves workspace:* dependencies)
# --legacy: pnpm v10에서 inject-workspace-packages 없이 deploy 허용
RUN pnpm --filter web deploy /app/deploy --prod --legacy

# Copy build output to deploy directory
RUN cp -r /app/apps/web/build /app/deploy/build

# -----------------------------
# Production stage (SSR Node.js)
# -----------------------------
FROM node:lts-alpine AS production

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
# 컨테이너 내부 포트는 3000 고정 (외부 매핑은 compose.yml에서 제어)
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

# Start the application
CMD ["node", "build"]
