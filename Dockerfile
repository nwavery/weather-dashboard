# --- Build stage: compile the React/Vite front-end ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime stage: tiny Express server that serves dist/ and /api/pollen ---
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist
# Cloud Run provides PORT (defaults to 8080); the server reads it.
EXPOSE 8080
CMD ["node", "server/index.js"]
