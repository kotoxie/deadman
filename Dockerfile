# Stage 1: Install all deps & build frontend
FROM node:20-alpine AS build
WORKDIR /app

# Install backend deps (includes vite for build)
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install

# Install frontend deps
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install

# Copy source
COPY frontend/ ./frontend/
COPY backend/src/ ./backend/src/

# Build frontend → backend/public/
RUN cd frontend && npx vite build

# Stage 2: Production (lean image)
FROM node:20-alpine AS production
WORKDIR /app

# Create a dedicated non-root user to run the application
RUN addgroup -S deadman && adduser -S deadman -G deadman

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev
COPY backend/src/ ./src/
COPY --from=build /app/backend/public ./public/

# Ensure the data directory exists and is owned by the non-root user
RUN mkdir -p /app/data && chown -R deadman:deadman /app

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=6680
EXPOSE 6680
VOLUME ["/app/data"]

USER deadman
CMD ["node", "src/index.js"]
