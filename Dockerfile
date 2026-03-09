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
RUN cd backend && npm run build

# Stage 2: Production (lean image)
FROM node:20-alpine AS production
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev
COPY backend/src/ ./src/
COPY --from=build /app/backend/public ./public/

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=6680
EXPOSE 6680
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
