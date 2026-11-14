# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
FROM node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS toolchain
RUN corepack enable && mkdir -p /app && chown node:node /app
WORKDIR /app
USER node
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM toolchain AS development
COPY --chown=node:node index.html style.css tsconfig.json vite.config.ts ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node public/ ./public/
COPY --chown=node:node server/ ./server/
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

FROM toolchain AS build
ARG VITE_ICE_CONFIG_URL=/ice-servers.json
ARG VITE_TURN_CREDENTIALS_URL=
ARG VITE_PEER_HOST=
ARG VITE_PEER_PORT=
ARG VITE_PEER_PATH=/
ARG VITE_PEER_SECURE=true
ARG VITE_LOBBY_NAMESPACE=
ENV VITE_ICE_CONFIG_URL=$VITE_ICE_CONFIG_URL \
    VITE_TURN_CREDENTIALS_URL=$VITE_TURN_CREDENTIALS_URL \
    VITE_PEER_HOST=$VITE_PEER_HOST \
    VITE_PEER_PORT=$VITE_PEER_PORT \
    VITE_PEER_PATH=$VITE_PEER_PATH \
    VITE_PEER_SECURE=$VITE_PEER_SECURE \
    VITE_LOBBY_NAMESPACE=$VITE_LOBBY_NAMESPACE
COPY --chown=node:node index.html style.css tsconfig.json vite.config.ts vite.server.config.ts ./
COPY --chown=node:node scripts/generate-notices.mjs ./scripts/generate-notices.mjs
COPY --chown=node:node third_party/licenses/ ./third_party/licenses/
COPY --chown=node:node src/ ./src/
COPY --chown=node:node public/ ./public/
COPY --chown=node:node server/ ./server/
RUN pnpm build

# Standalone static site: no application runtime and no credential API.
FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03 AS static
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
USER 101
EXPOSE 8080

# Same-origin static site and optional credential service for a VPS.
FROM node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS app
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --from=build --chown=node:node /app/dist/ ./dist/
COPY --from=build --chown=node:node /app/dist-server/server.mjs ./server.mjs
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD node -e "const req=require('node:http').get({hostname:'127.0.0.1',port:8080,path:'/healthz'},r=>process.exit(r.statusCode===200?0:1)); req.on('error',()=>process.exit(1)); req.setTimeout(2000,()=>process.exit(1))"
CMD ["node", "server.mjs"]
