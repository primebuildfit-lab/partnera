# Partnera — production/staging container (Block 9). Build is deferred to deploy;
# nothing is built or pushed here. Node 20 + pnpm; runs the web host.
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Install deps (allow the few required build scripts, e.g. esbuild/prisma).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile

# Build all packages + the web bundle.
RUN pnpm build && pnpm --filter @partnera/web bundle

# Generate the Prisma client for the hosted (postgres) store.
# (Requires DATABASE_URL at migrate-deploy time; client generation is offline.)
RUN pnpm --filter @partnera/persistence exec prisma generate --schema prisma/schema.prisma || echo "prisma generate deferred"

ENV NODE_ENV=production
ENV PORT=8080
ENV PARTNERA_PERSISTENCE=postgres
EXPOSE 8080

# Health check hits the public /health endpoint (no secrets).
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:'+ (process.env.PORT||8080) +'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/web/dist/server.mjs"]
