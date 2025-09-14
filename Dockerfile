# Multi-stage build for Spotify MCP Server
FROM node:18-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@8

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json packages/*/
COPY apps/*/package.json apps/*/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build all packages
RUN pnpm build

# Production stage
FROM node:18-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S spotify -u 1001 -G nodejs

# Install pnpm
RUN npm install -g pnpm@8

WORKDIR /app

# Copy built application
COPY --from=builder --chown=spotify:nodejs /app/apps/server/dist ./dist
COPY --from=builder --chown=spotify:nodejs /app/packages/*/dist ./node_modules/@spotify-mcp/*/dist
COPY --from=builder --chown=spotify:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=spotify:nodejs /app/package.json ./

# Create directories for volume mounts
RUN mkdir -p /config /secrets .cert && chown -R spotify:nodejs /config /secrets .cert

# Copy example config
COPY --chown=spotify:nodejs config.local.example.json ./config.local.example.json

# Create volume mount points
VOLUME ["/config", "/secrets", "/app/.cert"]

# Health check script
COPY --chown=spotify:nodejs <<EOF /app/healthcheck.js
const https = require('https');
const options = {
  hostname: 'localhost',
  port: 8888,
  path: '/health',
  timeout: 2000,
  rejectUnauthorized: false
};

const req = https.request(options, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('error', () => process.exit(1));
req.on('timeout', () => process.exit(1));
req.end();
EOF

# Switch to non-root user
USER spotify

# Environment variables
ENV NODE_ENV=production
ENV SPOTIFY_MCP_CONFIG=/config/config.json
ENV SPOTIFY_MCP_LOG_LEVEL=info

# Expose HTTPS port for OAuth
EXPOSE 8888

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Set entrypoint to the MCP server
ENTRYPOINT ["node", "dist/index.js"]

# Default command (empty for MCP stdio)
CMD []

# Labels
LABEL org.opencontainers.image.title="Spotify MCP Server"
LABEL org.opencontainers.image.description="Modern, robust Spotify MCP server using hexagonal architecture"
LABEL org.opencontainers.image.version="0.1.0"
LABEL org.opencontainers.image.vendor="Spotify MCP"
LABEL org.opencontainers.image.licenses="MIT"