# Production image for the fleet NestJS app. Install + build happen at image
# build time; the container's entrypoint only runs migrations then starts the
# server (via bin/start, so fleet.conf stays the single source of truth for the
# start command). The fleet injects PORT / BASE_PATH / DATABASE_URL at runtime.
FROM node:22-bookworm-slim

ARG BUILD_ID=unknown
ENV NODE_ENV=production
WORKDIR /app

# Install deps first so the layer caches on lockfile changes only. devDeps are
# needed for `nest build`, so install everything, build, then prune.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

EXPOSE 3000
ENTRYPOINT ["./bin/start"]
