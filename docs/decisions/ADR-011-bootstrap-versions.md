# ADR-011 — Versiones del bootstrap

- **Estado:** **APROBADA**
- **Fecha:** 2026-11-12 (verificación de workarounds: 2026-11-12)
- **Decisores:** Tech Lead (bootstrap) con revisión humana pendiente de acta
- **Contexto del proyecto:** Prompt 03 — esqueleto técnico del monorepo, sin lógica de negocio
- **Relacionado:** `docs/21-bootstrap-versions.md`, ADR-001 (monolito modular), ADR-005 (PostgreSQL + Prisma + Docker), ADR-006 (proveedor de producción)

## 1. Contexto

MarketCentral necesita un monorepo ejecutable antes de escribir el modelo Prisma y los módulos de
negocio. El bootstrap debía fijar versiones **verificadas**, no recordadas, y dejar constancia de los
compromisos que esas versiones imponen (ESM en NestJS, Node 24, Prisma 7 vs. 8 RC, imagen Docker
disponible).

El repositorio ya contenía la documentación de producto, arquitectura y datos (`docs/01`–`20`), que
este ADR **no modifica**. También estaba vacío de código: no había `package.json`, ni repositorio
Git.

## 2. Decisión

Se fijan las siguientes versiones para el esqueleto (detalle y fuentes en `docs/21`):

| Ámbito            | Decisión                                                                 |
| ----------------- | ------------------------------------------------------------------------ |
| Runtime           | **Node.js 24.22.3 LTS**, rango `>=24.0.0 <25`                            |
| Gestor            | **pnpm 12.18.0** (`packageManager`), workspaces + **Turborepo 2.11.11**   |
| Web               | **Next.js 16.4.6** (App Router, Turbopack), **React 19.3.1**, **Tailwind 4.3.5** |
| API               | **NestJS 12.5.0** en **ESM** (`"type": "module"`, `NodeNext`)            |
| Datos             | **Prisma CLI y client 7.10.1** fijados; **PostgreSQL 18.6-bookworm** en Docker local; sin `schema.prisma` |
| Calidad           | **TypeScript 5.9.3**, **ESLint 10.14.0** (flat), **Prettier 3.10.1**      |
| Pruebas           | **Jest 30.5.2** con **ts-jest 29.4.15**, **Supertest 7.3.2**, **Playwright 1.65.0** (sin specs) |
| Contenedores      | Docker Compose con un único servicio (`postgres`)                        |

## 3. Alternativas consideradas

| Alternativa | Por qué se descartó |
| ----------- | ------------------- |
| Node 26 LTS | Prisma 7 declara `^24.0.0`; 26 no aparece en el rango soportado. Se prioriza compatibilidad del ORM. |
| Node 22 LTS | Sigue en mantenimiento y no aporta ventaja frente a 24; además fija un techo de motor más bajo. |
| `typescript@latest` (7.0.2) | `typescript-eslint@8.72.2` declara peer `<6.1.0`; usar 7.x dejaría el lint sin soporte declarado. |
| `typescript@6.0.3` | Cumple el peer, pero es un salto mayor reciente; se prefiere 5.9.3, probado con Next 16 y Nest 12. |
| `prisma@latest` | El tag `latest` apunta a **8.0.0-rc.33** (release candidate). Se fija 7.10.1, que es GA. |
| Prisma 8 RC | Sin garantía de estabilidad ni de migración entre RCs; el modelo aún no existe, no hay urgencia. |
| `nest start` con `@nestjs/cli` | Añade un CLI pesado para un health endpoint; `tsx watch` + `tsc` cubren dev y build sin capa extra. |
| CommonJS en la API | NestJS 12 publica ESM; forzar CJS obligaría a `require` interop y a un tsconfig distinto del declarado por el framework. |
| `@swc/jest` | Su binding nativo exige una caché con DACL concreta y falla en este entorno (`SWC native addon: … Acceso denegado`). |
| `postgres:18.7` | El tag no existe en Docker Hub todavía; `18.6-bookworm` es el último 18.x publicado. |
| Split de `apps/worker` | Descartado en ADR-001 (Opción B): los jobs corren dentro de `apps/api` con `@nestjs/schedule`. |

## 4. Consecuencias

**Positivas**

- Versiones verificadas y fijadas: instalaciones reproducibles con `--frozen-lockfile`.
- Un solo runtime (Node 24) para API, web, tests y tooling.
- El health endpoint, OpenAPI y los tests de humo dan una base mínima observable desde el día uno.
- La API arranca en ESM, alineada con el paquete de NestJS 12; no habrá migración posterior.

**Negativas y riesgos**

- **ESM en NestJS**: `reflect-metadata` debe importarse antes del bootstrap y las librerías CJS se
  consumen por interop. Cualquier dependencia CJS problemática se documentará y, si bloquea, se
  evaluará CJS solo en la API (registrado como decisión abierta, no como cambio silencioso).
- **TypeScript 5.9.3** quedará por detrás de 7.x hasta que `typescript-eslint` amplíe su peer.
- **Prisma 7 vs. 8**: la migración a 8 se planificará cuando haya GA; el `schema.prisma` se escribirá
  en la etapa siguiente y conviene revisar entonces las notas de migración.
- **PostgreSQL 18.6 local vs. 18.7 upstream**: diferencia de parche; se revisará el tag de la imagen.
- **Sin Docker verificado**: el compose está escrito y revisado, pero no se ejecutó en este equipo.

## 5. Criterios de revisión

Se revisará este ADR si:

1. Prisma 8 pasa a GA y `latest` deja de apuntar a un RC.
2. `typescript-eslint` admite TypeScript 7 (o la versión mayor vigente).
3. NestJS publica una versión que requiera otro modo de módulos.
4. Docker Hub publica `postgres:18.7` (o superior estable dentro de 18.x).
5. Aparece una incompatibilidad CJS/ESM documentada que obligue a cambiar el modo de la API.
6. El equipo adopta una herramienta de build distinta de Turbopack para la web.

## 6. Verificación de workarounds (2026-11-12)

Se auditaron los tres workarounds de `apps/web/next.config.ts` que se añadieron para compilar en el
entorno del bootstrap, para distinguir una limitación del sandbox de una necesidad real del proyecto.
Se retiraron los tres, se compiló y se reincorporaron uno a uno para atribuir cada fallo:

| Configuración de `next.config.ts`       | Resultado real                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Sin workarounds                         | ❌ `Turbopack build failed` · `apps/web/app/page.tsx:1:1` · `Module not found: Can't resolve '@marketcentral/ui'` |
| Solo `turbopack.resolveAlias`           | ❌ Compila y falla al recolectar datos de páginas: `spawn EPERM` (4 workers)                                  |
| Alias + `typescript.ignoreBuildErrors`  | ❌ Igual: `spawn EPERM` en "Collecting page data using 4 workers"                                            |
| Los tres                                | ✅ `5 successful, 5 total`                                                                                   |

**Conclusión.** Ningún fallo es un error de TypeScript del código: son dos restricciones del entorno
(sin privilegio de symlink, pnpm crea junctions `Global\…` que Turbopack no recorre; y bloqueo de
subprocesos con stdio canalizado). Los tres workarounds se conservan **marcados con `TODO`** y con
referencia a `docs/21-bootstrap-versions.md` §6.4, donde están los comandos para que el humano
confirme que no son necesarios en un entorno real. No se añadió ningún sustituto.

En el mismo paso se corrigió un defecto **real** del código, no un workaround:
`apps/web/instrumentation.ts` importaba `node:path` y usaba `process.cwd()` en el ámbito superior,
lo que Turbopack rechaza al compilar el hook para Edge. Ahora hace importaciones dinámicas dentro de
`if (process.env.NEXT_RUNTIME !== 'nodejs') return;` y la carga del `.env` raíz vive en
`apps/web/src/lib/root-env.ts`.

**Otras verificaciones del paso:** `pnpm check` → lint, typecheck y `format:check` en verde;
`pnpm test` → 3/3 (1 test de API, 2 de web); `pnpm install --frozen-lockfile` con pnpm 12.18.0 →
`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK` en `%LOCALAPPDATA%\pnpm-store-operation-locks\all-stores.lock`
(`Acceso denegado`, os error 5). El `pnpm-lock.yaml` sigue generado con pnpm 10.18.3 y debe
regenerarse con pnpm 12 en un entorno con `%LOCALAPPDATA%` escribible antes de fijar CI.

**Consecuencia sobre el estado:** la verificación se completó en el entorno real del humano. Los tres
bloques se eliminaron de `apps/web/next.config.ts` y el build pasa sin ellos, lo que confirma que
fueron workarounds del sandbox y no necesidades del proyecto. Por eso este ADR queda **APROBADA**
(C-13, 2026-11-12). La limpieza editorial del comentario de cabecera de `next.config.ts` se completó
en C-14: el archivo conserva solo las notas de bootstrap (entorno en la raíz y `transpilePackages`).

## 7. Historial

| Fecha      | Cambio                                                        |
| ---------- | ------------------------------------------------------------- |
| 2026-11-12 | Creación. Versiones verificadas y bootstrap ejecutado.         |
| 2026-11-12 | Verificación de workarounds de sandbox; estado con verificación pendiente en entorno real. |
| 2026-11-12 | Corrección real de `apps/web/instrumentation.ts` (importaciones dinámicas y `src/lib/root-env.ts`). |
| 2026-11-12 | Verificación en entorno real completada; los workarounds se eliminaron y el estado pasa a APROBADA (C-13). |
| 2026-11-12 | **C-14:** limpieza del comentario de cabecera de `next.config.ts`; el archivo queda sin referencias a workarounds. |
