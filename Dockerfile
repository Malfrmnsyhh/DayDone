# Stage 1: Base runtime with pnpm & openssl
FROM node:24-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

# Stage 2: Builder - compile TypeScript & generate Prisma Client
FROM base AS builder
WORKDIR /workspace

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @daydone/shared run build
RUN pnpm --filter api run build

# Stage 3: Deployer - isolate production dependencies for API
FROM base AS deployer
WORKDIR /workspace

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @daydone/shared run build
RUN pnpm --filter api deploy --prod /prod/api

# Stage 4: Production Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy isolated production dependencies
COPY --from=deployer /prod/api /app

# Copy compiled dist and prisma files from builder
COPY --from=builder /workspace/apps/api/dist /app/dist
COPY --from=builder /workspace/apps/api/prisma /app/prisma
COPY --from=builder /workspace/apps/api/prisma.config.ts /app/prisma.config.ts

# Run container as unprivileged non-root user 'node'
RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["pnpm", "run", "start:prod"]

