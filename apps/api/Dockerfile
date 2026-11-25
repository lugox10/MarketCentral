# Imagen de producción de la API de MarketCentral.
#
# El contexto de build es la RAÍZ del monorepo (Render: dockerContext = "."),
# porque pnpm necesita el lockfile y los workspace packages para resolver.
#
# Uso local:
#   docker build -f apps/api/Dockerfile -t marketcentral-api .
#   docker run --rm -p 3001:3001 --env-file .env marketcentral-api

# ---------- build ----------
FROM node:24-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# argon2 y otras dependencias nativas necesitan compilador si no hay prebuild.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Se instala pnpm con npm en vez de corepack: corepack está en desuso y su
# activación depende de la versión de Node de la imagen base.
RUN npm install -g pnpm@12.18.0

WORKDIR /app

# Solo los manifiestos primero: si no cambian, la capa de install se reutiliza.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @marketcentral/api...

# `tsconfig.build.json` extiende la configuración compartida: debe existir antes
# de compilar, igual que el paquete de ESLint si algún día se ejecuta lint aquí.
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config
COPY apps/api ./apps/api

# El cliente Prisma se genera en node_modules (fuera de dist), por eso se hace
# antes de compilar y se copia al stage final.
RUN pnpm --filter @marketcentral/api exec prisma generate \
    && pnpm --filter @marketcentral/api build

# ---------- runtime ----------
FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# node_modules de pnpm se copia completo: los symlinks de apps/api/node_modules
# apuntan de forma relativa a /app/node_modules/.pnpm, así que ambos deben viajar
# juntos. El cliente Prisma generado vive dentro de esa carpeta.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

USER node

# Render inyecta PORT; en local se usa API_PORT (ver main.ts y env.validation.ts).
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
