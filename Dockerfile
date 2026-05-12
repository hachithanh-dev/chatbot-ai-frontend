# =============================================================================
# Stage 1: Build — Install dependencies and compile TypeScript + Vite bundle
# =============================================================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better Docker layer caching
# npm ci only re-runs when package*.json changes
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Build-time environment variables (baked into JS bundle by Vite)
# These MUST be passed via --build-arg during docker build
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Copy source code and build
COPY . .
RUN npm run build

# =============================================================================
# Stage 2: Serve — Production Nginx with only the compiled static files
# =============================================================================
FROM nginx:1.27-alpine

# Patch all OS-level vulnerabilities (OpenSSL, libxml2, libpng, musl, zlib)
# nginx:1.27-alpine ships with outdated system packages that have known CVEs.
# This ensures Trivy scan passes in CI pipeline.
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

# Run as non-root user — defense in depth
# If attacker exploits Nginx, they get "nginx" user (limited) instead of "root"
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Copy built assets from build stage
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# OCI Labels — metadata for image management (visible via docker inspect)
LABEL org.opencontainers.image.title="chatbot-frontend" \
      org.opencontainers.image.description="AI Chatbot Frontend — Nginx + Vite SPA"

# Health check — Docker/Compose uses this to know if the container is alive
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80

# Switch to non-root user for runtime
USER nginx

CMD ["nginx", "-g", "daemon off;"]
