# Build stage
FROM node:lts-alpine3.22 AS builder

# Set working directory
WORKDIR /app

# Copy package files from root and admin app
COPY package*.json ./
COPY apps/admin/package*.json ./apps/admin/

# Install all dependencies
COPY apps/web/package.json apps/web/pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy application source
COPY apps/admin ./apps/admin

# Build the application
RUN npm run build

COPY . .
WORKDIR /app/apps/web
RUN pnpm install --frozen-lockfile
RUN pnpm add -D @sveltejs/adapter-static
RUN pnpm build

# Production stage
FROM node:lts-alpine3.22 AS production

# Install dumb-init for proper signal handling
RUN apk update && apk add dumb-init

# Create non-root user
RUN useradd -m -u 1001 -s /bin/bash nodeuser

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nodeuser:nodeuser /app/apps/admin/build ./build
COPY --from=builder --chown=nodeuser:nodeuser /app/apps/admin/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Switch to non-root user
USER nodeuser

# Expose port (different from web app)
EXPOSE 3001

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "build"]

# Development stage (optional)
FROM node:lts-alpine3.22 AS development

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/admin/package*.json ./apps/admin/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose development port (different from web app)
EXPOSE 5174

# Set working directory to admin app
WORKDIR /app/apps/admin

# Start development server
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5174"]
