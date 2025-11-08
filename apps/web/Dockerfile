# Build stage
FROM node:24.11.0-trixie AS builder

# Set working directory
WORKDIR /app

# Copy package files from root and web app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Install all dependencies
RUN npm ci

# Copy application source
COPY apps/web ./apps/web

# Build the application
WORKDIR /app/apps/web
RUN npm run build

# Production stage
FROM node:24.11.0-trixie-slim AS production

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 -s /bin/bash nodeuser

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nodeuser:nodeuser /app/apps/web/build ./build
COPY --from=builder --chown=nodeuser:nodeuser /app/apps/web/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Switch to non-root user
USER nodeuser

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "build"]

# Development stage (optional)
FROM node:24.11.0-trixie AS development

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose development port
EXPOSE 5173

# Set working directory to web app
WORKDIR /app/apps/web

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]