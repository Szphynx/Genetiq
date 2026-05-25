# Universal single-container deploy: builds everything, then runs the Fastify
# API which also serves the built web SPA. Works on Render, Railway, Fly.io,
# a VPS, or any Docker host.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV GENETIQ_SERVE_WEB=true
ENV GENETIQ_WEB_DIST=/app/apps/web/dist
RUN corepack enable
# Bring over the installed deps and built output.
COPY --from=build /app /app
EXPOSE 8787
CMD ["node", "apps/api/dist/server.js"]
