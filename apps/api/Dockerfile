# Build from the repository root:  docker build -f apps/api/Dockerfile -t finova-api .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN if [ -f package-lock.json ]; then npm ci -w @finova/api --ignore-scripts; else npm install -w @finova/api --ignore-scripts; fi
COPY apps/api apps/api
RUN npm run build -w @finova/api

FROM node:22-alpine
ENV NODE_ENV=production PORT=4000 UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN if [ -f package-lock.json ]; then npm ci -w @finova/api --omit=dev --ignore-scripts; else npm install -w @finova/api --omit=dev --ignore-scripts; fi \
 && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/openapi.yaml apps/api/
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1
CMD ["node", "dist/server.js"]
