# MarketCentral

Monorepo de **MarketCentral**, un SaaS multi-vertical y multi-negocio con marketplace público
agregado y paneles privados por negocio. La primera vertical prevista es **Prenderías** en Medellín
y el Valle de Aburrá.

Este repositorio está en la etapa de **bootstrap**: contiene el esqueleto técnico (dos aplicaciones,
paquetes compartidos, Docker local, lint/typecheck/tests y un health endpoint). **No hay lógica de
negocio todavía**: no hay autenticación, CRUD, catálogo, leads, suscripciones, pagos ni esquema
Prisma. El modelo de datos está documentado en [`docs/`](docs/README.md) y se traducirá a Prisma en
una etapa posterior.

---

## 1. Prerrequisitos

| Herramienta   | Versión exigida | Notas                                                                         |
| ------------- | --------------- | ----------------------------------------------------------------------------- |
| Node.js       | `>=24.0.0 <25`  | Probado con **24.22.3**. Prisma 7 declara `^24.0.0`; Node 26 no está listado. |
| pnpm          | `>=12.0.0 <13`  | Probado con **12.18.0** vía Corepack.                                         |
| Docker Engine | reciente        | Solo para PostgreSQL local (opcional para lint/tests).                        |
| Git           | reciente        | El repositorio aún no está inicializado.                                      |

Con Corepack:

```bash
corepack enable
corepack prepare pnpm@12.18.0 --activate
node -v   # v24.x
pnpm -v   # 12.x
```

## 2. Instalación

```bash
pnpm install --frozen-lockfile
```

Si el lockfile y los `package.json` están sincronizados, `--frozen-lockfile` es el comando
reproducible. Para actualizar dependencias de forma deliberada, usa `pnpm install` sin la bandera y
revisa el diff de `pnpm-lock.yaml`.

## 3. Variables de entorno

Copia el ejemplo y ajusta lo necesario:

```bash
cp .env.example .env
```

| Variable              | Ejemplo                                                           | Usada por | Descripción                                                             |
| --------------------- | ----------------------------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`        | `postgresql://postgres:postgres@localhost:5432/marketcentral_dev` | API       | Conexión a PostgreSQL. La API es la única que habla con la base.        |
| `API_PORT`            | `3001`                                                            | API       | Puerto HTTP de NestJS (1–65535).                                        |
| `NODE_ENV`            | `development`                                                     | ambas     | `development` \| `test` \| `production`.                                |
| `CORS_ORIGINS`        | `http://localhost:3000`                                           | API       | Orígenes permitidos, separados por coma. Sin comodines en producción.   |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001`                                           | Web       | URL pública de la API. En producción debe ser `https` (salvo loopback). |
| `POSTGRES_DB`         | `marketcentral_dev`                                               | Docker    | Base creada por el contenedor.                                          |
| `POSTGRES_USER`       | `postgres`                                                        | Docker    | Usuario del contenedor.                                                 |
| `POSTGRES_PASSWORD`   | `postgres`                                                        | Docker    | Contraseña local, no de producción.                                     |

`.env` está en `.gitignore`; `.env.example` solo contiene valores locales de ejemplo. El archivo
vive en la **raíz** del monorepo: la API lo lee con `@nestjs/config` y la web lo carga en
`next.config.ts` e `instrumentation.ts`, porque Next solo buscaría `.env` dentro de `apps/web`.

## 4. Ejecución local

```bash
# 1. PostgreSQL (opcional hasta que exista el esquema Prisma)
pnpm db:up

# 2. API y web en paralelo
pnpm dev
```

| Servicio             | URL                                 |
| -------------------- | ----------------------------------- |
| Web (Next.js)        | http://localhost:3000               |
| API (NestJS)         | http://localhost:3001               |
| Health               | http://localhost:3001/health        |
| OpenAPI (Swagger UI) | http://localhost:3001/api/docs      |
| OpenAPI (JSON)       | http://localhost:3001/api/docs-json |
| PostgreSQL           | `localhost:5432` (solo localhost)   |

Los puertos 3000, 3001 y 5432 se eligieron por ser los habituales de Next, Nest y PostgreSQL; si
otro servicio del equipo los ocupa, cambia `API_PORT`/`NEXT_PUBLIC_API_URL` y el mapeo del compose.

Producción local simulada (útil para verificar el build):

```bash
pnpm build
pnpm --filter @marketcentral/api start
pnpm --filter @marketcentral/web start
```

## 5. Comandos

| Comando           | Qué hace                                                         |
| ----------------- | ---------------------------------------------------------------- |
| `pnpm dev`        | `turbo run dev`: API y web con recarga en caliente.              |
| `pnpm build`      | `turbo run build`: typecheck + `tsc` (API) y `next build` (web). |
| `pnpm lint`       | ESLint en todos los paquetes.                                    |
| `pnpm typecheck`  | `tsc --noEmit` en todos los paquetes.                            |
| `pnpm test`       | Jest: test de `GET /health` (API) y render de la home (web).     |
| `pnpm test:e2e`   | Playwright (configurado, sin specs todavía).                     |
| `pnpm check`      | `lint` + `typecheck` + `format:check`.                           |
| `pnpm format`     | Prettier sobre el repositorio.                                   |
| `pnpm db:up/down` | Levanta o detiene PostgreSQL con Docker Compose.                 |
| `pnpm db:logs`    | Sigue los logs del contenedor de PostgreSQL.                     |

`turbo run build` ejecuta la tarea `typecheck` de cada paquete antes de compilar; el `next build`
tiene su propio typecheck interno desactivado (ver §9) para no duplicarlo.

## 6. Estructura

```text
marketcentral/
├── apps/
│   ├── api/                 # NestJS 12 (ESM), monolito modular
│   │   ├── src/config/      # validación de variables de entorno
│   │   ├── src/health/      # GET /health
│   │   ├── src/app.module.ts
│   │   └── test/            # smoke test con Supertest
│   └── web/                 # Next.js 16 App Router + Tailwind 4
│       ├── app/             # layout, page, globals.css
│       ├── src/lib/         # lectura/validación de entorno
│       └── test/            # smoke test con Jest + Testing Library
├── packages/
│   ├── ui/                  # Button mínimo con Tailwind (placeholder)
│   ├── api-client/          # placeholder del cliente OpenAPI
│   ├── typescript-config/   # tsconfig base/node/next
│   └── eslint-config/       # flat config compartida
├── infrastructure/docker/docker-compose.yml
├── docs/                    # documentación de producto, arquitectura y datos
├── e2e/                     # Playwright (sin specs todavía)
├── .vscode/                 # extensiones y ajustes recomendados
├── turbo.json
└── pnpm-workspace.yaml
```

## 7. Convenciones

- **Fronteras**: la web nunca importa código de la API ni se conecta a PostgreSQL; la API es la
  única que habla con la base. Los paquetes de `packages/` son consumibles por ambas apps.
- **Sin imports cruzados** entre `apps/web` y `apps/api`: lo compartido va a `packages/`.
- **TypeScript strict** en todos los paquetes (`strict`, `noUncheckedIndexedAccess`).
- **ESM**: la API es ESM nativo (`"type": "module"`, `module`/`moduleResolution` `NodeNext`); la web
  usa el bundler de Next. Jest de la API corre en ESM (`--experimental-vm-modules`), el de la web en
  CJS.
- **Nombres**: módulos, entidades y estados en inglés; documentación y textos de UI en español.
- **Secretos**: nunca en el repositorio; `.env` ignorado y `.env.example` con placeholders.
- **Datos**: sin datos reales en seeds o tests.

## 8. Estado de la verificación

Ejecutado el 2026-11-12 con Node 24.22.3 y pnpm 10.18.3 (workaround, ver §9):

| Comando                | Resultado                                                           |
| ---------------------- | ------------------------------------------------------------------- |
| `pnpm install`         | OK (lockfile v9.0 generado)                                         |
| `turbo run lint`       | OK, 6 tareas                                                        |
| `turbo run typecheck`  | OK, 6 tareas                                                        |
| `turbo run build`      | OK, 5 tareas (API `dist/`, web `.next/`)                            |
| `turbo run test`       | OK: API 1 test, web 2 tests                                         |
| `docker compose up -d` | **Bloqueado**: el daemon de Docker no estaba corriendo en el equipo |
| `GET /health`          | 200 `{"status":"ok","timestamp":"…","uptime":…}`                    |
| `GET /api/docs`        | 200 (Swagger UI) y `/api/docs-json` 200                             |
| `GET /` (next start)   | 200 con el texto "MarketCentral — en construcción"                  |

## 9. Notas de entorno (Windows)

Durante el bootstrap aparecieron restricciones del equipo que conviene conocer:

- **`pnpm@12` necesita escribir en `%LOCALAPPDATA%`** (lock de store y store global). En un entorno
  donde esa carpeta no es escribible, la instalación falla con
  `ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK (os error 5)`. La verificación de este repositorio se hizo
  con `pnpm@10.18.3` ejecutado como script (`node .../pnpm.cjs`) y ajustando `packageManager` de
  forma temporal; el `package.json` versionado apunta a **pnpm 12.18.0**, que es la versión objetivo.
- **Sin privilegio de symlink**, pnpm crea _junctions_ con prefijo `Global\` que Turbopack no
  resuelve. Por eso `.npmrc` usa `node-linker=hoisted` e `inject-workspace-packages=true`, y
  `next.config.ts` declara un `turbopack.resolveAlias` para `@marketcentral/ui`.
- **Subprocesos con stdio canalizado fallan** (`spawn EPERM`) en el sandbox usado: eso obligó a
  poner `typescript.ignoreBuildErrors` (el typecheck corre aparte en turbo), a limitar Next a un
  worker y a ejecutar Jest con `--runInBand`.
- **SWC nativo no carga** en ese entorno (`SWC native addon: … Acceso denegado`), así que el
  transformador de Jest es **ts-jest**, no `@swc/jest`.
- **Docker Desktop no estaba corriendo**, por lo que el compose no se pudo levantar; el archivo está
  validado por revisión, no por ejecución.

En un equipo sin esas restricciones, `pnpm install && pnpm dev` es el camino esperado. Las
decisiones de versión y sus fuentes están en [`docs/21-bootstrap-versions.md`](docs/21-bootstrap-versions.md)
y [`docs/decisions/ADR-011-bootstrap-versions.md`](docs/decisions/ADR-011-bootstrap-versions.md).
