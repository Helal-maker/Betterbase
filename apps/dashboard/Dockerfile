# ============================================================================
# Betterbase Dashboard Dockerfile
#
# Builds the React dashboard and serves it with nginx.
# Used in production self-hosted deployments.
#
# Build:
#   docker build -f apps/dashboard/Dockerfile -t betterbase-dashboard .
# ============================================================================

FROM oven/bun:1.3.9-debian AS builder

WORKDIR /app/apps/dashboard

COPY apps/dashboard/package.json apps/dashboard/bun.lock* ./

RUN bun install --frozen-lockfile

COPY . .

ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

RUN bun run build

FROM nginx:alpine

RUN addgroup -g 101 -S nginx && adduser -S nginx -u 101

COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html

RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Health check endpoint
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback - all routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
EOF

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:80/health || exit 1

USER nginx

CMD ["nginx", "-g", "daemon off;"]