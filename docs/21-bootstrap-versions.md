# 21 — Matriz de versiones del bootstrap

**Fecha de consulta:** 2026-11-12
**Estado:** versiones ejecutables fijadas y verificadas; bootstrap aprobado por ADR-011 (C-13)
**Alcance:** esqueleto técnico del monorepo. No traduce el modelo ER ni implementa lógica de negocio.

> Convención: **verificado** = consultado en la fuente oficial indicada el 2026-11-12;
> **inferencia** = deducido de esos datos sin confirmación explícita; **no verificado** = sin fuente
> consultable en esta sesión. La fecha de consulta aplica a todas las filas.

## 1. Runtime y herramientas

| Componente       | Versión elegida | Versión instalada / verificada | Estado     | Fuente y nota                                                                                   |
| ---------------- | --------------- | ------------------------------ | ---------- | ----------------------------------------------------------------------------------------------- |
| Node.js          | 24.22.3 LTS     | 24.22.3                        | verificado | <https://nodejs.org/en/about/previous-releases> — LTS "Krypton"; 26.x es LTS más reciente pero Prisma 7 solo declara `^24.0.0`. |
| pnpm             | 12.18.0         | 12.18.0 objetivo / 10.18.3 en la verificación | verificado | <https://registry.npmjs.org/pnpm> — `latest: 12.18.0`; engines `node >=18`. Ver §6.2 (workaround). |
| Turborepo        | 2.11.11         | 2.11.11                        | verificado | <https://registry.npmjs.org/turbo> — `latest: 2.11.11`.                                          |
| Docker Engine    | no fijada       | 29.2.0 (cliente)               | no verificado | El daemon no estaba corriendo; no se pudo validar `docker compose` en ejecución.              |
| PostgreSQL local | 18.6 (imagen)   | no ejecutado                   | verificado | <https://hub.docker.com/_/postgres> — el tag `18.7` **no existe**; el último 18.x es `18.6-bookworm` (digest `sha256:f1ea2a1a…`, publicado 2026-11-05). Upstream ya publicó 18.7. |

## 2. Aplicaciones

| Componente        | Versión | Estado     | Fuente y nota                                                                                          |
| ----------------- | ------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| Next.js           | 16.4.6  | verificado | <https://registry.npmjs.org/next> — engines `node >=20.9.0`; Turbopack es el bundler por defecto.       |
| React / React DOM | 19.3.1  | verificado | <https://registry.npmjs.org/react> — `latest: 19.3.1`; par requerido por Next 16.                      |
| NestJS            | 12.5.0  | verificado | <https://registry.npmjs.org/@nestjs/core> — ESM (`"type": "module"`), engines `node >=20`.             |
| @nestjs/config    | 12.1.1  | verificado | <https://registry.npmjs.org/@nestjs/config>                                                             |
| @nestjs/swagger   | 12.1.1  | verificado | <https://registry.npmjs.org/@nestjs/swagger>                                                            |
| @nestjs/schedule  | 12.0.3  | verificado | <https://registry.npmjs.org/@nestjs/schedule> — los jobs viven en `apps/api` (ADR-001, Opción B).      |
| Tailwind CSS      | 4.3.5   | verificado | <https://registry.npmjs.org/tailwindcss> — integración vía `@tailwindcss/postcss` 4.3.5.                |
| PostCSS           | 8.5.32  | verificado | <https://registry.npmjs.org/postcss>                                                                    |
| class-validator   | 0.15.1  | verificado | <https://registry.npmjs.org/class-validator> — usado por la validación de entorno.                      |
| class-transformer | 0.5.1   | verificado | <https://registry.npmjs.org/class-transformer>                                                          |
| reflect-metadata  | 0.2.2   | verificado | <https://registry.npmjs.org/reflect-metadata> — necesario para DI de Nest.                              |

## 3. Datos

| Componente      | Versión | Estado     | Fuente y nota                                                                                                                                   |
| --------------- | ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma CLI      | 7.10.1  | verificado | <https://registry.npmjs.org/prisma> — el tag `latest` apunta a **8.0.0-rc.33**; se fija 7.10.1 explícitamente (`prev`). Sin `schema.prisma` todavía. |
| @prisma/client  | 7.10.1  | verificado | <https://registry.npmjs.org/@prisma/client> — engines `^20.19 \|\| ^22.12 \|\| >=24`.                                                            |
| PostgreSQL prod | Neon Free | verificado | `docs/decisions/ADR-006` (APROBADA, C-07). |

## 4. Calidad y pruebas

| Componente               | Versión | Estado     | Fuente y nota                                                                                                    |
| ------------------------ | ------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| TypeScript               | 5.9.3   | verificado | Se instala 5.9.3 aunque `latest` sea 7.0.2: `typescript-eslint@8.72.2` declara peer `typescript >=4.8.4 <6.1.0`. |
| ESLint                   | 10.14.0 | verificado | <https://registry.npmjs.org/eslint> — flat config.                                                               |
| typescript-eslint        | 8.72.2  | verificado | <https://registry.npmjs.org/typescript-eslint> — peer `eslint ^8.57 \|\| ^9 \|\| ^10`.                            |
| eslint-config-prettier   | 10.1.8  | verificado | <https://registry.npmjs.org/eslint-config-prettier>                                                              |
| eslint-plugin-react-hooks| 7.1.1   | verificado | <https://registry.npmjs.org/eslint-plugin-react-hooks>                                                           |
| Prettier                 | 3.10.1  | verificado | <https://registry.npmjs.org/prettier>                                                                            |
| Jest                     | 30.5.2  | verificado | <https://registry.npmjs.org/jest> — engines incluyen `>=24`.                                                     |
| jest-environment-jsdom   | 30.5.2  | verificado | <https://registry.npmjs.org/jest-environment-jsdom>                                                              |
| ts-jest                  | 29.4.15 | verificado | <https://registry.npmjs.org/ts-jest> — peer `jest ^29 \|\| ^30`; sustituye a `@swc/jest` (§6.3).                 |
| Supertest                | 7.3.2   | verificado | <https://registry.npmjs.org/supertest>                                                                           |
| @testing-library/react   | 16.3.3  | verificado | <https://registry.npmjs.org/@testing-library/react>                                                              |
| Playwright               | 1.65.0  | verificado | <https://registry.npmjs.org/@playwright/test> — configurado, sin specs.                                          |
| tsx                      | 4.23.15 | verificado | <https://registry.npmjs.org/tsx> — `dev` en la API (sin `nest start`).                                           |

## 5. Restricciones y hallazgos relevantes

1. **`prisma` con tag `latest` = 8.0.0-rc.33.** Nunca instalar `prisma@latest`; fijar `7.10.1`.
2. **NestJS 12 es ESM.** `apps/api` usa `"type": "module"` + `module`/`moduleResolution` `NodeNext`.
   Los decoradores exigen `experimentalDecorators` y `emitDecoratorMetadata`; `reflect-metadata` se
   importa antes del bootstrap.
3. **Prisma 7 no lista Node 26.** Node 24.22.3 es la versión LTS compatible.
4. **Docker Hub no tiene `postgres:18.7`.** Se usa `18.6-bookworm`; conviene revisar el tag cuando
   exista para alinear con PostgreSQL 18.7.
5. **`@swc/jest` no es viable en este entorno** (binding nativo + caché con DACL): ver §6.3.
6. **Next 16 ya no ejecuta lint en `next build`**; el lint es una tarea aparte de Turborepo.
7. **`turbopackPluginRuntimeStrategy: 'workerThreads'` está deshabilitado en Node 24.22.3** por un
   bug de teardown de worker threads (nodejs/node#65100): Next cae a `childProcesses`.
8. **Extensiones de PostgreSQL**: el MVP solo depende de `pg_trgm` y de `uuidv7()` del core de PG 18
   (ver `docs/08` y `docs/14`).

## 6. Notas de ejecución en este equipo

### 6.1 Zona de instalación

`pnpm@12` escribe un lock en `%LOCALAPPDATA%\pnpm-store-operation-locks` y un store global en
`%LOCALAPPDATA%\pnpm`. Si esa ruta no es escribible, `pnpm install` termina con
`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK … (os error 5)`. Se mitigó con `.npmrc`
(`store-dir`, `cache-dir` y `state-dir` dentro de `.cache/`) y ejecutando `pnpm@10.18.3` como
script, con `packageManager` ajustado temporalmente. El `package.json` versionado mantiene
`packageManager: "pnpm@12.18.0"`.

### 6.2 Layout de `node_modules`

Sin privilegio de symlink, pnpm crea *junctions* `Global\…` que Turbopack no recorre. `.npmrc` fija
`node-linker=hoisted` e `inject-workspace-packages=true`, y `apps/web/next.config.ts` resuelve
`@marketcentral/ui` con `turbopack.resolveAlias`. Cuando el equipo permita symlinks, se puede volver
al linker aislado y retirar el alias.

### 6.3 Transformador de Jest

`@swc/jest` falla con `Failed to load native binding` porque el addon exige un directorio de caché
con una DACL concreta (`SWC native addon: … Acceso denegado`). Se sustituyó por **ts-jest**, que usa
el compilador de TypeScript y emite los metadatos de decoradores que necesita Nest. La API corre
Jest en ESM y la web en CJS; ambos con `--runInBand` porque el sandbox bloquea subprocesos con
stdio canalizado (`spawn EPERM`).

### 6.4 Workarounds de sandbox

`apps/web/next.config.ts` contiene **tres bloques** marcados con `TODO(entorno-real)` que existen
solo por las restricciones del entorno donde se generó el bootstrap. No son decisiones de
arquitectura y deben retirarse cuando se confirme que no hacen falta.

| # | Workaround | Qué síntoma evita | ¿Necesario fuera del sandbox? |
| - | ---------- | ----------------- | ----------------------------- |
| 1 | `typescript.ignoreBuildErrors: true` | `next build` lanza su typecheck en un subproceso y el sandbox lo bloquea (`spawn EPERM`) | **Probablemente no.** En un entorno normal el subproceso funciona. El typecheck nunca queda sin correr: `turbo run build` ejecuta la tarea `typecheck` (`tsc --noEmit`) antes de compilar. |
| 2 | `turbopack.resolveAlias['@marketcentral/ui']` | Sin privilegio de symlink, pnpm crea junctions `Global\…` que Turbopack no recorre: `Module not found: Can't resolve '@marketcentral/ui'` | **No**, si pnpm puede crear symlinks reales. Con `.npmrc` en `node-linker=hoisted` + `inject-workspace-packages=true` y symlinks disponibles, la resolución normal funciona. |
| 3 | `experimental.cpus: 1` + `workerThreads: true` | La recolección de datos de páginas usa un pool de procesos hijos: `spawn EPERM` con "Collecting page data using 4 workers" | **No.** Es una restricción de subprocesos del sandbox, no del build. |

**Verificación realizada (2026-11-12).** Se retiraron los tres bloques, se compiló y se volvió a
añadir cada uno de forma incremental para atribuir el fallo:

| Configuración | Resultado real |
| ------------- | -------------- |
| Sin ningún workaround | ❌ `Turbopack build failed` · `./apps/web/app/page.tsx:1:1` · `Module not found: Can't resolve '@marketcentral/ui'` |
| Solo `turbopack.resolveAlias` | ❌ Compila, pero falla al recolectar datos de páginas: `spawn EPERM` (4 workers) |
| Alias + `ignoreBuildErrors` | ❌ Igual: `spawn EPERM` en "Collecting page data using 4 workers" |
| Los tres bloques | ✅ `5 successful, 5 total` (build de API, web y paquetes) |

Ninguno de los tres fallos es un error de TypeScript del código: son restricciones del entorno
(junctions sin symlink y subprocesos bloqueados). Por eso los tres quedaron restaurados **con
comentario `TODO`**, y no se sustituyeron por otra cosa.

**Corrección real aplicada en el mismo paso (no es workaround).** `apps/web/instrumentation.ts`
importaba `node:path` y usaba `process.cwd()` en el ámbito superior, lo que Turbopack marcaba al
compilar el hook para el runtime Edge ("A Node.js module is loaded ('node:path') … not supported in
the Edge Runtime"). Ahora `instrumentation.ts` solo hace importaciones dinámicas dentro del bloque
`NEXT_RUNTIME === 'nodejs'`, y la carga del `.env` raíz vive en `src/lib/root-env.ts`. Verificado:
build limpio y `GET /` → 200 con `next start`.

**Lockfile.** `pnpm install --frozen-lockfile` con **pnpm 12.18.0** falla aquí con
`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK` al abrir
`C:\Users\Lugo\AppData\Local\pnpm-store-operation-locks\all-stores.lock` (`Acceso denegado`, os
error 5). El `pnpm-lock.yaml` actual se generó con **pnpm 10.18.3**; debe regenerarse con pnpm 12 en
un entorno con `%LOCALAPPDATA%` escribible antes de fijar CI.

#### Cómo confirmar en un entorno real que los workarounds no son necesarios

```bash
# 1. Instalar con la versión objetivo del gestor
corepack enable && corepack prepare pnpm@12.18.0 --activate
pnpm install --frozen-lockfile

# 2. Quitar los tres bloques marcados TODO en apps/web/next.config.ts
#    (typescript.ignoreBuildErrors, turbopack.resolveAlias, experimental.*)

# 3. Compilar y verificar
pnpm build                # debe terminar con "Tasks: 5 successful, 5 total"
pnpm check                # lint + typecheck + format:check
pnpm test                 # 3 tests (1 API + 2 web)

# 4. Comprobar el runtime
pnpm --filter @marketcentral/api start   # en otra terminal
pnpm --filter @marketcentral/web start
curl -i http://localhost:3001/health     # 200 {"status":"ok",...}
curl -i http://localhost:3000            # 200, "MarketCentral — en construcción"
```

Si los tres pasos anteriores pasan sin los bloques, el bootstrap queda limpio: hay que borrar los
`TODO` y actualizar este documento y ADR-011 a "APROBADA" sin condiciones. Si falla alguno, el
mensaje de error dirá cuál de los tres sigue siendo necesario; conviene registrar la versión de
pnpm, el sistema operativo y si el usuario tiene permiso de symlink.

**Resultado (2026-11-12, C-13 y C-14):** la verificación se ejecutó en el entorno real, los tres
bloques se eliminaron de `apps/web/next.config.ts` y el build pasó sin ellos. Este documento y
[ADR-011](decisions/ADR-011-bootstrap-versions.md) quedan **APROBADOS**. La limpieza editorial del
comentario de cabecera de `next.config.ts` también se completó (C-14): el archivo ya no menciona
bloques de workaround.

## 7. Fuentes consultadas

Todas consultadas el **2026-11-12**:

- Node.js releases: <https://nodejs.org/en/about/previous-releases>
- Registro npm (dist-tags y engines): `https://registry.npmjs.org/<paquete>` para cada fila de §1–§4
- Docker Hub PostgreSQL: <https://hub.docker.com/_/postgres>
- Next.js (Turbopack por defecto y build sin lint): <https://nextjs.org/docs>
- NestJS 12 ESM: <https://docs.nestjs.com/>
- Prisma 7 requisitos: <https://www.prisma.io/docs/orm/reference/system-requirements>
- Neon (límites del plan Free): <https://neon.com/docs/introduction/plans>
- Tailwind CSS 4 con PostCSS: <https://tailwindcss.com/docs/installation/framework-guides/nextjs>
- Jest 30 / ts-jest compatibilidad: <https://jestjs.io/docs/getting-started> y
  <https://kulshekhar.github.io/ts-jest/docs/getting-started/installation>

Las URLs del registro npm devuelven JSON; se citan como fuente de la versión exacta y del campo
`engines`, no como documentación narrativa.
