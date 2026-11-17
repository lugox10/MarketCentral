# 14 — Matriz de versiones y compatibilidad verificada

**Fecha de consulta:** 2026-11-12 (America/Bogota) · **Estado:** documento para revisión

> **Regla:** ninguna versión de este documento se fija "de memoria". Cada fila indica si el dato fue **verificado** en fuente oficial o si es una **inferencia**. Lo no verificado queda **PENDIENTE** y no debe usarse para bloquear la instalación.
>
> Las versiones exactas se fijarán con `pnpm` (sin rangos `^`) al iniciar la implementación, y se registrarán en el lockfile del Prompt 02/03.

---

## 1. Matriz principal

| Componente | Versión objetivo | Estado del dato | Fuente | Notas de compatibilidad |
|-----------|------------------|-----------------|--------|--------------------------|
| Node.js | **24.22.3 LTS "Krypton"** | Verificado (release schedule) | nodejs.org/en/about/previous-releases | Es la LTS que satisface a la vez Next 16 (`>=20.9`), Nest 12 (`>=20`) y Prisma 7 (`^20.19 \|\| ^22.12 \|\| ^24.0`). **Node 26 LTS queda fuera del rango declarado por Prisma 7** → no usar para el MVP. |
| pnpm | **12.18.0** | Verificado (npm dist-tags) | registry.npmjs.org/-/package/pnpm/dist-tags | Requiere Node `>=18`. |
| Turborepo (`turbo`) | **2.11.11** | Verificado (npm dist-tags) | registry.npmjs.org/-/package/turbo/dist-tags | Sin conflicto conocido con pnpm 12; validar en el arranque. |
| Next.js | **16.4.6** | Verificado (npm dist-tags) | registry.npmjs.org/-/package/next/dist-tags | Engines `node >=20.9.0`; TS mínimo 5.1; peers React `^18.2.0 \|\| ^19.0.0`; Turbopack por defecto; desde v16 `next build` no ejecuta lint. |
| React | **19.3.1** | Verificado (npm dist-tags) | registry.npmjs.org/-/package/react/dist-tags | Satisface el peer de Next 16 (`^18.2.0 \|\| ^19.0.0`). Fijar también `react-dom` 19.3.1. |
| TypeScript | Por decidir entre **7.0.2** (latest) y una línea anterior estable | Parcial: `latest` verificado; línea 5.x/6.x **PENDIENTE** | registry.npmjs.org/-/package/typescript/dist-tags | Prisma exige `>=5.4`; Next exige `>=5.1`. TypeScript 7.0 es un cambio mayor de compilador: **no adoptar sin prueba de humo** con Nest 12 + Prisma 7. |
| NestJS core | **12.5.0** | Verificado (npm dist-tags) | registry.npmjs.org/-/package/@nestjs/core/dist-tags | **Paquetes ESM** (`"type": "module"`); implica `module: NodeNext` y revisar librerías CommonJS. Peers: `@nestjs/common ^12`, `reflect-metadata ^0.1.12 \|\| ^0.2.0`, `rxjs ^7.1.0`. |
| `@nestjs/swagger` | **12.1.1** | Verificado (npm dist-tags) | registry.npmjs.org/-/package/@nestjs/swagger/dist-tags | Debe corresponder a Nest 12 (inferencia: la línea 12 acompaña a Nest 12). Existe `legacy` 11.4.8. |
| Prisma ORM (CLI y cliente) | **7.10.1 (exacta)** | Verificado: `@prisma/client` latest 7.10.1; `prisma` `prev` 7.10.1 | registry.npmjs.org/-/package/@prisma/client/dist-tags | **No usar `latest`**: el tag `latest` del CLI apunta a `8.0.0-rc.33`. Prisma 7 soporta PostgreSQL 9.6–18; Node `^20.19 \|\| ^22.12 \|\| >=24.0`; TS `>=5.4`. |
| PostgreSQL | **18.7** | Verificado (versiones oficiales) | postgresql.org/support/versioning/ | 18 liberado 2025-09-25, soporte hasta 2030-11-14. PG 19 está en RC2 (no usar en producción). **En producción la versión la define Neon** (18.x a la fecha de creación del proyecto): verificar en la consola y registrar aquí. |
| Proveedor PostgreSQL (producción) | **Neon Free**, región `aws-sa-east-1` (São Paulo) | Verificado (planes y regiones) | neon.com/docs/introduction/plans · neon.com/docs/introduction/regions | 1 GB storage, 100 CU-hours/mes, *scale-to-zero* a los 5 min (no desactivable en Free), sin SLA, *instant restore* 6 h, 1 snapshot manual y **sin backups diarios gestionados**. Escalado a Launch: [ADR-006](decisions/ADR-006-production-database-provider.md) §2.2. |
| `uuidv7()` nativo de PostgreSQL 18 | Disponible (función del core, sin extensión) | Verificado (documentación PG 18) | postgresql.org/docs/18/functions-uuid.html | Permite generar el identificador en la base con `DEFAULT uuidv7()`; alternativa: generarlo en la aplicación. Decisión final en Prompt 02 (D-01). |
| `pg_trgm` en Neon | Disponible (extensión estándar) | Verificado en catálogo de extensiones de Neon | neon.com/docs/extensions/pg_trgm | Necesaria para búsqueda tolerante a errores ([08 §6](08-non-functional-requirements.md)). |
| Imagen Docker de PostgreSQL | `postgres:18.7` o `postgres:18-alpine` | Verificado (tags publicados) | hub.docker.com/_/postgres | Fijar tag completo, no `latest`. |
| Tailwind CSS | **4.3.5** | Verificado (npm dist-tags) | registry.npmjs.org/-/package/tailwindcss/dist-tags | v3 LTS disponible como 3.4.19 si se requiere compatibilidad con plugins antiguos. Tailwind 4 cambia configuración (CSS-first). |
| Jest | **30.5.2** | Verificado (npm dist-tags) | registry.npmjs.org/-/package/jest/dist-tags | Verificar `ts-jest`/transformador compatible antes de fijar. |
| Supertest | **7.3.2** | Verificado (npm dist-tags) | registry.npmjs.org/-/package/supertest/dist-tags | Sin conflicto conocido. |
| Playwright | **1.65.0** | Verificado (npm dist-tags) | registry.npmjs.org/-/package/playwright/dist-tags | Navegadores se instalan por versión; fijar la misma versión en CI. |
| Docker Engine / Compose | Sin versión fijada | **PENDIENTE** | — | Verificar versión local del equipo y del host de despliegue antes de documentar el `compose.yaml`. |
| Cloudflare R2 | Servicio (sin versión) | Verificado (precios y features) | developers.cloudflare.com/r2/pricing/ | Compatible con S3 API; egress gratuito; free tier 10 GB. |

---

## 2. Restricciones de compatibilidad detectadas

1. **Node 26 no es compatible con Prisma 7** según el rango `engines` publicado. Aunque Next 16 y Nest 12 lo aceptarían, el ORM condiciona la elección: **Node 24 LTS**.
2. **NestJS 12 es ESM.** Un proyecto CommonJS con `ts-node`/`ts-jest` requerirá configuración específica; se decide ESM desde el inicio para evitar una migración costosa.
3. **Prisma 8 aún no es GA.** El tag `latest` del CLI apunta a un release candidate; usar `latest` en CI produce builds no reproducibles y posible rotura. Fijar `7.10.1`.
4. **TypeScript 7.0** es la versión `latest`, pero es un cambio mayor; Nest 12 y Prisma 7 declaran compatibilidad con la línea 5.x+. Adoptar 7.0 exige prueba de humo (decoradores, `reflect-metadata`, generación de Prisma).
5. **Tailwind 4** no es compatible con la configuración `tailwind.config.js` clásica de la misma forma que v3; si se elige v4, la configuración es CSS-first.
6. **Next 16** ya no ejecuta ESLint en `next build`: el lint debe ser un paso explícito de CI.
7. **PostgreSQL 18** es la versión objetivo. El proveedor elegido (Neon, [ADR-006](decisions/ADR-006-production-database-provider.md)) ofrece 18.x; si en el momento de crear el proyecto solo ofreciera 17, Prisma 7 sigue siendo compatible (soporta 9.6–18), pero la versión debe registrarse aquí antes del Prompt 02.
8. **Extensiones:** el diseño solo usa `pg_trgm` (documentada en el catálogo de extensiones de Neon) y `uuidv7()` del core de PostgreSQL 18. No se adoptan extensiones propietarias ni `pgvector`/PostGIS en el MVP ([ADR-006](decisions/ADR-006-production-database-provider.md)).
9. **Conexión con el pooler de Neon:** PgBouncer en modo transacción no admite `SET` de sesión, `LISTEN/NOTIFY` ni `PREPARE` a nivel SQL; el acceso a datos debe ser transaccional y sin estado de sesión (`https://neon.com/docs/connect/connection-pooling`).

---

## 3. Stack recomendado para iniciar implementación (PROPUESTA)

```text
Node.js            24.22.3 LTS (Krypton)
pnpm               12.18.0
Turborepo          2.11.11
Next.js            16.4.6
React               19.3.1 (react + react-dom)
TypeScript         por decidir (7.0.2 con prueba de humo, o línea estable anterior)
NestJS             12.5.0
@nestjs/swagger    12.1.1
Prisma             7.10.1 (exacta, CLI y cliente)
PostgreSQL         18.7 (Docker local)
Producción (BD)    Neon Free · aws-sa-east-1 (verificar versión de PG al crear)
Tailwind CSS       4.3.5
Jest               30.5.2
Supertest          7.3.2
Playwright         1.65.0
```

**Reglas de fijación**

- Sin `^` ni `~` en las dependencias de aplicación; lockfile commiteado.
- Renovación de dependencias en una tarea dedicada, con pruebas y revisión de changelog.
- Prohibido actualizar Prisma a 8 hasta que sea GA y exista guía de migración verificada.
- Las actualizaciones de parches de seguridad se aplican fuera de ciclo si el proveedor lo indica.

---

## 4. Lo que NO se pudo verificar

| Elemento | Motivo | Acción |
|----------|--------|--------|
| Línea estable anterior de TypeScript | Solo se consultó `latest` | Consultar dist-tags por línea antes de decidir |
| Docker Engine / Compose | Sin consulta | Verificar en el equipo local y en el host |
| Compatibilidad `@nestjs/swagger` 12.1.1 ↔ Nest 12.5.0 | Inferida por línea mayor | Confirmar `peerDependencies` al instalar |
| `ts-jest` compatible con Jest 30 + ESM | No consultado | Evaluar `@swc/jest` como alternativa |
| Proveedor de correo transaccional | No evaluado | Comparar en Prompt 02 |
| Proveedor de pagos recurrente | No evaluado | Ver Q-06 |
| Precios de Render | Página sin cifras utilizables | No usar cifras de Render sin nueva consulta |
| Versión exacta de PostgreSQL de Neon | Se define al crear el proyecto; no se puede consultar sin una cuenta | Registrar en la consola y actualizar esta tabla antes del Prompt 02 |
| Región de hosting de `api`/`web` | No decidida | Debe minimizar latencia hacia São Paulo |

---

## 5. Fuentes consultadas (2026-11-12)

| Fuente | Uso |
|--------|-----|
| `https://registry.npmjs.org/-/package/<pkg>/dist-tags` | Versiones `latest`/`next`/`prev` de los paquetes |
| `https://unpkg.com/<pkg>@<version>/package.json` | `engines`, `peerDependencies`, `type` |
| `https://nodejs.org/en/about/previous-releases` | Estado de las líneas de Node |
| `https://www.postgresql.org/support/versioning/` | Versiones y fin de soporte |
| `https://hub.docker.com/_/postgres` | Tags de imagen disponibles |
| `https://www.prisma.io/docs/orm/more/upgrade-guides` y documentación de Prisma | Estado de ORM 8 (RC), requisitos de Prisma 7 |
| `https://supabase.com/pricing`, `https://supabase.com/docs/guides/platform/backups` | Comparación de proveedor (alternativa descartada para el MVP) |
| `https://neon.com/docs/introduction/plans`, `https://neon.com/docs/introduction/regions`, `https://neon.com/docs/guides/scale-to-zero-guide` | Límites del plan Free, regiones y *scale-to-zero* de Neon |
| `https://neon.com/docs/connect/connection-pooling`, `https://neon.com/docs/guides/prisma` | Pooler de Neon, cadenas pooled/directa y setup de Prisma 7 |
| `https://neon.com/docs/extensions/pg_trgm` | Disponibilidad de `pg_trgm` en Neon |
| `https://www.postgresql.org/docs/18/functions-uuid.html` | `uuidv7()` nativo en PostgreSQL 18 |
| `https://developers.cloudflare.com/r2/pricing/` | Costos de storage |
| `https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html` | Parámetros de hashing |

Los enlaces y su estado se detallan en el informe final, sección I.
