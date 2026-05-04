FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-slim AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM node:22-slim
WORKDIR /app

# Install tsx for running TypeScript directly
RUN npm i -g tsx

COPY backend/ ./
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/bgamedex.db

# Non-root runtime user. /data is a Fly volume mounted at boot, so its
# ownership is fixed up in the entrypoint (image-time chown wouldn't stick).
RUN useradd -r -u 10001 -g root nodeuser && \
    mkdir -p /data && \
    chown -R nodeuser:root /app /data && \
    printf '#!/bin/sh\nset -e\nif [ "$(id -u)" = "0" ]; then\n  chown -R 10001:0 /data 2>/dev/null || true\n  exec setpriv --reuid=10001 --regid=0 --clear-groups -- "$@"\nfi\nexec "$@"\n' > /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# Seed DB if it doesn't exist, then start server
CMD ["sh", "-c", "if [ ! -f /data/bgamedex.db ]; then tsx src/seed.ts; fi && tsx src/index.ts"]
