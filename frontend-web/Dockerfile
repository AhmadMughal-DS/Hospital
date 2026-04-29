# ─────────────────────────────────────────────────────────────────
# MediCore HMS — Production Frontend Dockerfile
# Stage 1: Node build → Stage 2: Nginx static serve
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (cached layer)
COPY package*.json ./
RUN npm ci --prefer-offline

# Build args for Vite environment
ARG VITE_DJANGO_API_BASE=http://localhost:8000
ARG VITE_QUEUE_API_BASE=http://localhost:8000
ENV VITE_DJANGO_API_BASE=$VITE_DJANGO_API_BASE
ENV VITE_QUEUE_API_BASE=$VITE_QUEUE_API_BASE

COPY . .
RUN npm run build

# ─── Runtime Stage: Nginx ────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Copy compiled assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
