# ====================================================================
# Stage 1: Build stage
# ====================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies deterministically
COPY package*.json ./
RUN npm ci

# Copy sources and bundle SPA
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src/ ./src/
RUN npm run build

# ====================================================================
# Stage 2: Hardened Nginx Runtime
# ====================================================================
FROM nginx:1.27-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom hardened nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
