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

EXPOSE 8080

# Seed DB if it doesn't exist, then start server
CMD ["sh", "-c", "if [ ! -f /data/bgamedex.db ]; then tsx src/seed.ts; fi && tsx src/index.ts"]
