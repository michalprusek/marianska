# =============================================================================
# Stage 1: Build dependencies (cached layer)
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy only package files first for better layer caching
COPY package*.json ./

# Limit Node.js memory for low-RAM servers
ENV NODE_OPTIONS="--max-old-space-size=512"

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --prefer-offline

# =============================================================================
# Stage 2: Production image
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install only runtime dependencies for native modules
RUN apk add --no-cache libstdc++

# Limit Node.js memory for low-RAM servers
ENV NODE_OPTIONS="--max-old-space-size=512"

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY package*.json ./
COPY server.js ./
COPY database.js ./
COPY data.js ./
COPY translations.js ./
COPY js/ ./js/
COPY css/ ./css/
COPY migrations/ ./migrations/
COPY *.html ./
COPY admin.js ./
COPY favicon.* ./

# Create directories for runtime data
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app

# Use non-root user for security
USER node

EXPOSE 3000

# Health check (use 127.0.0.1 instead of localhost to avoid IPv6 issues)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "server.js"]