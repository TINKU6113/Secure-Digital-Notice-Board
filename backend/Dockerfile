# ====================================================================
# Stage 1: Build stage
# ====================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies deterministically
COPY package*.json ./
RUN npm ci

# Copy TypeScript sources and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ====================================================================
# Stage 2: Minimal Production Runtime
# ====================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Non-root execution for container security
USER node

# Expose only the application listening port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start production server
CMD ["node", "dist/server.js"]
