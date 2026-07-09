# --- Stage 1: build the Vue/Vite client -------------------------------------
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- Stage 2: production runtime ---------------------------------------------
# node:sqlite (used by server/db) needs Node >=22.5 — matches package.json engines.
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3900
ENV DB_PATH=/app/data/onefocus.db

# Server deps only — the client is already built to static files, its own
# node_modules (Vue/Vite/etc.) never need to exist in the runtime image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

# SQLite file lives here — mount a volume at /app/data to persist it (see docker-compose.yml).
RUN mkdir -p /app/data

EXPOSE 3900

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3900/api/health').then(r=>{if(!r.ok)throw new Error()}).catch(()=>process.exit(1))"

# --experimental-sqlite: node:sqlite (server/db/index.js) needs this flag on
# Node 22.x — it's a harmless no-op on versions where it's unflagged by default.
CMD ["node", "--experimental-sqlite", "server/index.js"]
