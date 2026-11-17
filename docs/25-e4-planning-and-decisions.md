# 25 — Preparación técnica de E4: planes, suscripciones y cobro manual

**Estado:** PROPUESTA para aprobación humana. No se modificó esquema, seed, código ni datos.
**Fecha:** 2026-11-17 · **Alcance:** planificación y documentación (Prompt de preparación de E4).
**Reglas de negocio base:** APROBADAS por el cliente (tabla de planes, duraciones, activación manual, historial).

---

## A. Inspección del repositorio y de Git

> **Estado actual — RESUELTO (2026-11-17).** El humano ejecutó `git init -b main` y el primer commit. Verificado por lectura:
> - `git rev-parse --show-toplevel` → `C:/Users/Lugo/Downloads/MarketCentral`
> - `git log --oneline -1` → `54136ec feat: completadas E1 (Auth), E2 (Negocios) y E3 (Taxonomia)`
> - rama actual `main`; `git status --short` sin salida (árbol limpio)
>
> Lo que sigue en §A.1–§A.3 es la inspección **histórica** previa y el procedimiento que se recomendó; se conserva como registro, no como tarea pendiente.

### A.1 Dónde está el proyecto

| Dato | Valor |
|---|---|
| Directorio de trabajo del agente | `C:\Users\Lugo\Downloads\MarketCentral` |
| Raíz del monorepo | la misma ruta (contiene `apps/`, `packages/`, `docs/`, `package.json`, `pnpm-workspace.yaml`) |
| `Test-Path .git` | `False` |
| `git rev-parse --show-toplevel` | `fatal: not a git repository (or any of the parent directories): .git` |
| Búsqueda de `.git` desde la raíz hasta `C:\` | ninguna coincidencia en `MarketCentral`, `Downloads`, `Lugo`, `Users`, `C:\` |

**Conclusión (inspección histórica):** el repositorio no estaba inicializado. No existía repositorio superior, no había worktree y Harness trabajaba sobre la raíz correcta del proyecto. El `.gitignore` existía desde el bootstrap, pero sin `.git` no tenía efecto. **Hoy ya está inicializado (§A, estado actual).**

### A.2 Por qué importa ahora

E4 introduce migraciones nuevas sobre datos que hoy solo viven en una base local. Sin control de versiones:

- no hay forma de volver a un estado anterior si una migración sale mal;
- no hay historial de qué cambió ni por qué;
- el `dist/` de la API y `.next/` de la web están en disco (ignorados por `.gitignore`, pero sin repo no hay nada que ignorar).

### A.3 Procedimiento seguro recomendado (histórico, ya ejecutado por el humano)

Las órdenes que siguen se propusieron y el humano las ejecutó por su cuenta (`git init -b main` + commit `54136ec`). Se conservan como referencia del procedimiento; el paso 1 (respaldo) sigue recomendándose antes de cada migración.

```powershell
# 1) Respaldar el árbol completo ANTES de cualquier otra cosa (sin tocar el proyecto)
Compress-Archive -Path C:\Users\Lugo\Downloads\MarketCentral\* `
  -DestinationPath C:\Users\Lugo\Downloads\MarketCentral-backup-2026-11-17.zip

# 2) Inicializar el repositorio en la raíz del monorepo
cd C:\Users\Lugo\Downloads\MarketCentral
git init
git add .
git commit -m "chore: estado del proyecto antes de E4 (E1-E3)"

# 3) Verificar que los artefactos NO entran al commit
git status --short          # no debe listar node_modules, dist, .next, .cache, .tools, .env
git ls-files | Measure-Object -Line
```

Salvaguardas que conviene confirmar antes del primer commit:

- `.env` está ignorado y **no** aparece en `git status` (existe un `.env` real en la raíz con `DATABASE_URL`).
- `.cache/`, `.tools/` y `.turbo/` no se versionan.
- `pnpm-lock.yaml` **sí** se versiona (fija las dependencias).
- Tras el primer commit, crear una rama por épica (`feat/e4-subscriptions`) en lugar de trabajar sobre `main`.

Si prefieres no inicializar Git todavía, el respaldo del paso 1 es obligatorio antes de la primera migración de E4.

---

## B. Propuesta definitiva para el modelo `Plan` y sus duraciones

### B.1 Qué hay hoy

`apps/api/prisma/schema.prisma:173-187`:

```prisma
model Plan {
  id             String   @id
  code           PlanCode @unique
  name           String   @unique
  priceCop       Int      @map("price_cop")
  intervalMonths Int      @map("interval_months") @db.SmallInt
  trialDays      Int      @map("trial_days")      @db.SmallInt
  isActive       Boolean  @default(true)
}
```

Restricciones en la migración `20261114093000_init_business`:

```sql
CONSTRAINT "plan_price_cop_check"       CHECK ("price_cop" >= 0),
CONSTRAINT "plan_interval_months_check" CHECK ("interval_months" IN (1, 3, 6, 12)),
CONSTRAINT "plan_trial_days_check"      CHECK ("trial_days" >= 0 AND "trial_days" <= 90)
```

### B.2 Por qué no sirve para las reglas aprobadas

| Regla aprobada | Campo actual | Problema |
|---|---|---|
| FREE: dos meses **calendario** | `trial_days = 60` | 60 días no es lo mismo que dos meses calendario. Del 15 de enero al 15 de marzo hay 59 días (2026 no es bisiesto en febrero); del 1 de diciembre al 1 de febrero hay 62. El vencimiento se desplaza. |
| BASE/PRO: **30 días exactos** | `interval_months = 1` | Un mes calendario tiene 28–31 días. Además el `CHECK` solo admite 1, 3, 6 o 12 meses: no hay forma de expresar "30 días". |
| Límite de publicaciones (10/30/50) | no existe | No hay dónde persistir el límite que E5 necesita aplicar. |

Cálculo real hoy en `apps/api/src/modules/businesses/application/create-business.use-case.ts:66`:

```ts
const periodEnd = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);
```

Es aritmética de días exactos, no de meses calendario.

### B.3 Propuesta

```prisma
model Plan {
  id                String   @id
  code              PlanCode @unique
  name              String   @unique @db.VarChar(40)
  priceCop          Int      @map("price_cop")
  trialMonths       Int      @default(0) @map("trial_months") @db.SmallInt    // FREE = 2
  billingPeriodDays Int?     @map("billing_period_days") @db.SmallInt         // BASE/PRO = 30, FREE = NULL
  maxListings       Int      @map("max_listings")                             // 10 / 30 / 50
  isActive          Boolean  @default(true) @map("is_active")
}
```

Restricciones propuestas:

```sql
ALTER TABLE plan
  ADD COLUMN trial_months SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN billing_period_days SMALLINT,
  ADD COLUMN max_listings INTEGER NOT NULL DEFAULT 10,
  DROP CONSTRAINT plan_interval_months_check,
  DROP CONSTRAINT plan_trial_days_check,
  DROP COLUMN interval_months,
  DROP COLUMN trial_days;

ALTER TABLE plan
  ADD CONSTRAINT plan_trial_months_check CHECK (trial_months BETWEEN 0 AND 12),
  ADD CONSTRAINT plan_max_listings_check CHECK (max_listings > 0),
  ADD CONSTRAINT plan_billing_period_check CHECK (
    (code = 'FREE' AND billing_period_days IS NULL)
    OR (code <> 'FREE' AND billing_period_days BETWEEN 1 AND 365)
  );
```

Valores resultantes:

| Plan | `price_cop` | `trial_months` | `billing_period_days` | `max_listings` |
|---|---:|---:|---:|---:|
| `FREE` | 0 | 2 | `NULL` | 10 |
| `BASE` | 30.000 | 0 | 30 | 30 |
| `PRO` | 50.000 | 0 | 30 | 50 |

Semántica del cálculo:

- **Fin de prueba** = `addMonths(now, trialMonths)` (2 meses calendario; 31 de enero → 31 de marzo, con el ajuste habitual de fin de mes).
- **Fin de periodo pagado** = `now + billingPeriodDays días` (30 exactos).
- `trialMonths` y `billingPeriodDays` son excluyentes en la práctica: FREE tiene prueba y no periodo; BASE/PRO tienen periodo y no prueba.

### B.4 Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Seguir con `trial_days = 60` | No representa "dos meses calendario"; el usuario puede notar que su prueba termina el 14 de marzo y no el 15. |
| `interval_months` + lógica especial de 30 días | Un entero llamado "meses" que significa "30 días" es una mentira en la base; cualquiera que lea la tabla se equivoca. |
| Guardar `billingPeriod: ENUM('MONTHLY_30D')` | Añade un enum para un solo valor; el número de días es más honesto y admite cambios futuros (anual, trimestral) sin tocar el tipo. |
| Ambas columnas más `interval_months` de compatibilidad | Dos fuentes de verdad para lo mismo. |

### B.5 Impacto exacto de renombrar (referencias reales hoy)

| Archivo | Línea | Qué cambia |
|---|---|---|
| `apps/api/prisma/schema.prisma` | 178-179 | `intervalMonths`/`trialDays` → `trialMonths`/`billingPeriodDays`, más `maxListings` nuevo |
| `apps/api/prisma/seed.ts` | 44-46, 54-56 | datos de los tres planes (duraciones + `maxListings`) y el `upsert` |
| `apps/api/src/modules/businesses/application/ports.ts` | 24-26 | `PlanSummary` (+ `maxListings`) |
| `apps/api/src/modules/businesses/application/responses.ts` | 43-49 | `PlanResponseDto` (+ `maxListings`) |
| `apps/api/src/modules/businesses/application/create-business.use-case.ts` | 66, 88 | cálculo del periodo y decisión `TRIALING`/`ACTIVE` |
| `apps/api/src/modules/businesses/infrastructure/prisma-business.repository.ts` | 26-28, 43-45, 164-166 | mapeos de plan y suscripción |
| `apps/api/test/businesses.spec.ts` | 57-63, 134 | fixtures y aserciones |
| `apps/web/src/lib/business.ts` | 24-26 | tipo `Plan` del cliente (+ `maxListings`) |
| `apps/web/app/dashboard/negocio/page.tsx` | 136-138 | texto de precio (usa `priceCop`; hoy asume "mes") y límite de publicaciones |
| `docs/16-data-dictionary.md` | 267-268 | diccionario (`interval_months`, `trial_days`) |
| `docs/15-entity-relationship-model.md` | 158 | descripción de `plan` |

### B.6 Qué pasa con los datos existentes

- `marketcentral_dev`: 3 filas en `plan`, **0 negocios**. La migración solo reescribe esas 3 filas (`FREE` → `trial_months=2, billing_period_days=NULL, max_listings=10`; `BASE` → `0, 30, 30`; `PRO` → `0, 30, 50`).
- `marketcentral_test`: 5 negocios `TRIALING` con periodos calculados a 60 días. Es una base desechable: el próximo `pnpm test` la vuelve a sembrar. No requiere migración de datos.
- Producción: no existe. Ver [24-development-data-and-production-policy.md](24-development-data-and-production-policy.md).

### B.7 Límites por plan

**Decisión APROBADA (D-35, 2026-11-17):** columna `maxListings` en `plan`.

```prisma
maxListings Int @map("max_listings")   // FREE 10 · BASE 30 · PRO 50
```

Motivo de la decisión: E4 solo necesita **un** límite, y una columna tipada elimina un `JOIN`, un enum de claves y una validación de forma de `Json` que hoy no tendrían segundo consumidor. Los límites se leen junto con el plan en la misma consulta que ya hace el panel.

Alternativa descartada: `plan_entitlement` (`(plan_id, key)` + `value Json`), que proponía ADR-010 y que este documento recomendaba antes de la decisión. Es la ruta natural **si aparecen ≥3 límites distintos** (fotos por publicación, leads/mes, destacados). En ese momento se migra: se crea la tabla, se copia `max_listings` a la fila `listings.max` y se elimina la columna. No se hace ahora para no introducir dos mecanismos de límites con uno solo en uso.

Consecuencia en E5: el guard de publicaciones usa `plan.maxListings` directamente; si en el futuro se migra a entitlements, el puerto `PlanCatalog` es el único punto que cambia.

---

## C. Una `Subscription` actual por negocio + historial separado

**Confirmado como estrategia de E4.** Hoy `apps/api/prisma/schema.prisma:192` ya tiene `businessId String @unique`, y se mantiene.

### C.1 Por qué no se reutiliza `AuditLog`

No existe. La consulta a `information_schema` no devuelve ninguna tabla `%audit%`, y no hay módulo `Audit` en `apps/api/src`. Por tanto "reutilizar AuditLog" no es una opción real: habría que crearlo, y un log genérico de auditoría no es el lugar correcto para reconstruir el historial comercial de un negocio (importes, periodos, plan anterior/siguiente), ni para consultarlo desde la UI.

### C.2 Tabla propuesta: `subscription_activation` (inmutable, append-only)

```prisma
enum SubscriptionActivationKind {
  TRIAL_STARTED
  ACTIVATED
  RENEWED
  PLAN_CHANGED
  SUSPENDED
  REACTIVATED
  EXPIRED
  CANCELLED
}

model SubscriptionActivation {
  id                String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  subscriptionId    String   @map("subscription_id") @db.Uuid
  businessId        String   @map("business_id") @db.Uuid
  kind              SubscriptionActivationKind
  fromStatus        SubscriptionStatus? @map("from_status")
  toStatus          SubscriptionStatus  @map("to_status")
  fromPlanId        String?  @map("from_plan_id") @db.Uuid
  toPlanId          String   @map("to_plan_id") @db.Uuid
  periodStart       DateTime @map("period_start") @db.Timestamptz(6)
  periodEnd         DateTime @map("period_end") @db.Timestamptz(6)
  previousPeriodEnd DateTime? @map("previous_period_end") @db.Timestamptz(6)
  amountCop         Int      @default(0) @map("amount_cop")
  note              String   @db.VarChar(500)
  actorUserId       String   @map("actor_user_id") @db.Uuid
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  business     Business     @relation(fields: [businessId], references: [id], onDelete: Cascade)
  fromPlan     Plan?        @relation("ActivationFromPlan", fields: [fromPlanId], references: [id], onDelete: Restrict)
  toPlan       Plan         @relation("ActivationToPlan", fields: [toPlanId], references: [id], onDelete: Restrict)
  actor        User         @relation(fields: [actorUserId], references: [id], onDelete: Restrict)

  @@unique([subscriptionId, periodStart, kind])   // idempotencia de doble clic / reintento
  @@index([businessId, createdAt])
  @@index([actorUserId])
}
```

Reglas de uso:

- Solo `INSERT`. La aplicación nunca actualiza ni borra filas de `subscription_activation`.
- En producción, revocar `UPDATE`/`DELETE` a la base de negocio sobre esa tabla es la garantía dura (PENDIENTE para el despliegue).
- `note` obligatoria (5–500 caracteres) en toda activación/renovación, como ya exige `docs/18` §4 (R-21).

### C.3 Campos que se añaden a `Subscription`

```prisma
trialEndsAt DateTime? @map("trial_ends_at") @db.Timestamptz(6)   // se conserva al activar (histórico de la prueba)
```

No se duplican `activated_by_admin_id` ni `activation_note` en `subscription`: el actor y la nota de **cada** evento viven en `subscription_activation`, que es la fuente única. Esto difiere de `docs/18` §4 (que los pone en `subscription`) y se registra como enmienda propuesta a ese documento (ver F-06).

### C.4 Idempotencia (R-32)

Tres capas, sin índices parciales:

1. `Business.id` + `Subscription.businessId @unique`: no hay dos suscripciones vivas.
2. `SELECT ... FOR UPDATE` sobre la fila de `subscription` dentro de la transacción de activación.
3. `@@unique([subscriptionId, periodStart, kind])`: un reintento del mismo periodo y tipo devuelve `alreadyApplied` (200) en lugar de duplicar historial.

### C.5 Vencimiento sin proceso destructivo

El estado `EXPIRED` se marca con el job diario `ExpireSubscriptions` (ya existe `ScheduleModule` en `apps/api`), nunca como efecto secundario de un `GET`. La visibilidad del negocio se calcula con el predicado de `docs/18` §4.2 (cambia al verse afectado el estado), no archivando publicaciones en cascada (C-11.4).

---

## D. Negocios existentes sin suscripción

| Base | Negocios | Con suscripción | Sin suscripción |
|---|---:|---:|---:|
| `marketcentral_dev` | **0** | 0 | **0** |
| `marketcentral_test` | 5 | 5 | 0 |

No hay ningún negocio sin suscripción en desarrollo, así que **no hay nada que reparar y ningún backfill que justificar**. Los 5 negocios de `marketcentral_test` son residuos de la suite de pruebas y se recrean en cada ejecución.

Recomendación para aprobación humana: no hacer nada. Si en el futuro apareciera un negocio huérfano (por ejemplo, creado antes de E4 en otra máquina), la estrategia sería **una de estas dos**, nunca ambas:

- **(a)** marcarlo como `SUSPENDED` y pedir intervención del admin, o
- **(b)** crearle `FREE` con `trial_months` contados **desde la fecha de creación del negocio**, dejando constancia en `subscription_activation` con `note = 'regularización'` y `kind = TRIAL_STARTED`.

La (b) inventa una fecha pasada; la (a) es más honesta. Recomiendo (a) y dejar la (b) solo para un caso autorizado explícitamente.

---

## E. Sistema visual canónico

Se inspeccionaron `apps/web/src/components/modal.tsx`, `apps/web/src/components/taxonomy-ui.tsx`, `apps/web/app/admin/taxonomia/page.tsx`, `apps/web/app/globals.css`, `apps/web/app/layout.tsx` y `packages/ui/src/button.tsx`, y se extrajo el sistema real a **[ui-design-system.md](ui-design-system.md)**.

Sobre `.superdesign/design-system.md`: **no se creó**, y conviene que sepas por qué.

- La skill `superdesign` está instalada y visible, pero el CLI **no** está disponible en esta máquina (`superdesign --version` → comando no encontrado) y no existe `.superdesign/`.
- Generar ese archivo en su formato nativo requiere `npx --yes @superdesign/cli@latest` (descarga de paquete) y, para publicar en el canvas, `superdesign login` (interactivo, con tu cuenta). Ambas cosas quedan fuera de esta tarea: el prompt prohíbe instalar dependencias y no debo manejar tus credenciales.
- Escribir a mano un archivo con el "formato esperado" sin haberlo visto sería inventarlo, justo lo que el prompt prohíbe.

Ruta propuesta: `docs/ui-design-system.md` es la guía canónica (derivada del código, revisable en el repo). Cuando el CLI esté instalado y autenticado, `superdesign init` generará `.superdesign/init/` y desde ahí se puede derivar `design-system.md`, que debe **citar** la guía canónica y no contradecirla.

---

## F. Riesgos e inconsistencias detectados

| ID | Hallazgo | Impacto | Propuesta |
|---|---|---|---|
| F-01 | `trial_days = 60` no equivale a "dos meses calendario" | Vencimiento de prueba desplazado 1–2 días | §B.3 (`trial_months`) |
| F-02 | `interval_months` con `CHECK IN (1,3,6,12)` no puede expresar 30 días | BASE/PRO con periodo variable | §B.3 (`billing_period_days`) |
| F-03 | `plan` no tiene límite de publicaciones | E5 no puede aplicar 10/30/50 | columna `maxListings` (§B.7, D-35 **APROBADA**) |
| F-04 | `subscription` no guarda actor ni nota de activación | R-21 no es auditable | historial (§C.2) |
| F-05 | No existe tabla de auditoría de ningún tipo | "Reutilizar AuditLog" es imposible | historial dedicado (§C.1) |
| F-06 | `docs/18` §4 pone `activated_by_admin_id`/`activation_note` en `subscription`; el historial los pone en `subscription_activation` | Dos fuentes si se implementan ambas | Enmienda a `docs/18` (decisión humana) |
| F-07 | `packages/ui/src/button.tsx` tiene mojibake en el comentario (`Ãºnico`, `librerÃ­a`) y usa `emerald` en vez de `brand` | Segunda versión de botón con color distinto | Usar `buttonStyles()` de `taxonomy-ui.tsx`; retirar el placeholder en E5 |
| F-08 | No había repositorio Git | Sin red de seguridad para migraciones y sin historial | **RESUELTO** 2026-11-17: `main` + commit `54136ec` |
| F-09 | `docs/15`/`docs/16` describen `price_amount` + `price_currency`; el código usa `priceCop` | Divergencia documental ya registrada como D-29 | Ratificar `priceCop` (recomendado) y actualizar docs 15/16 |
| F-10 | Ambigüedad de negocio: en un **cambio Base→Pro** no está dicho si el periodo pendiente se conserva | Puede regalar o quitar días al negocio | **Resuelto** por D-37: se conserva lo pagado |

### Decisiones cerradas por el humano (2026-11-17) — todas APROBADAS

| ID | Pregunta | Decisión aprobada |
|---|---|---|
| **D-31** | Negocios sin suscripción en producción | Bloquear el panel del negocio y asignar Free **manual y auditado**; nunca automático en un `GET`. Sin backfill. |
| **D-35** | ¿`plan_entitlement` o columna `maxListings`? | **Columna `maxListings` en `plan`.** No se crea `plan_entitlement` en E4. |
| **D-36** | ¿Nota y actor de la activación en el historial? | **Tabla `subscription_activation` inmutable.** No se usa `AuditLog` (no existe) ni se duplica en `subscription`. |
| **D-37** | Cambio Base↔Pro: `max(period_end, now) + 30` vs `now + 30` | **Conservar lo pagado:** `period_end = max(period_end, now) + 30 días`, igual que la renovación anticipada. |
| **D-38** | ¿Suspensión por admin vs expiración por vencimiento? | **Son estados distintos:** `SUSPENDED` (decisión de `SUPER_ADMIN`) y `EXPIRED` (vencimiento del periodo). |
| **D-39** | ¿Superdesign CLI para `.superdesign/design-system.md`? | **No por ahora.** `docs/ui-design-system.md` es la guía canónica de E4 y siguientes. |

Consecuencias aplicadas en este documento: §B.7 y §G usan la columna `maxListings` (sin tabla de entitlements), §C.2 fija el único de idempotencia del historial, y §G.1 ya no crea `plan_entitlement`.

Riesgo residual que **no** cubren estas decisiones: la asignación manual de Free (D-31) exige un endpoint administrativo auditado que hoy no está en el alcance de E4; si aparece un negocio sin suscripción, la operación es manual en base de datos con registro en el historial (`ACTIVATED`, `amountCop: 0`, `note` obligatoria).

---

## G. Cambios exactos que se harían en E4 (no ejecutados)

### G.1 Base de datos — migración `init_subscriptions`

1. `ALTER TABLE plan`: `+trial_months`, `+billing_period_days`, `+max_listings`, `-interval_months`, `-trial_days`, y las constraints nuevas (§B.3). **No se crea `plan_entitlement`** (D-35).
2. `UPDATE plan` para las 3 filas: `FREE` (2 meses, `NULL`, 10), `BASE` (0, 30, 30), `PRO` (0, 30, 50).
3. `CREATE TYPE "SubscriptionActivationKind"`.
4. `CREATE TABLE subscription_activation` (§C.2) + `UNIQUE (subscription_id, period_start, kind)` + índices + `REVOKE UPDATE, DELETE` + trigger de inmutabilidad.
5. `ALTER TABLE subscription ADD COLUMN trial_ends_at`.
6. `_prisma_migrations` registrada con el checksum correcto (aplicador `pg`, como en E2/E3, porque `prisma migrate dev` no puede ejecutar su motor en este entorno).

### G.2 Backend — módulo `apps/api/src/modules/subscriptions/`

```
domain/subscription.ts            estados, transiciones válidas, cálculo de periodos (addMonths, addDays), límite maxListings
domain/subscription-error.ts      códigos: PLAN_NOT_FOUND, INVALID_TRANSITION, NOTE_REQUIRED,
                                  ALREADY_ON_PLAN, SUBSCRIPTION_NOT_FOUND, LISTING_LIMIT_REACHED
application/ports.ts              SubscriptionRepository (lee plan por código, incluido maxListings), ActivationWriter
application/activate-manually.use-case.ts     TRIALING|EXPIRED|CANCELLED|SUSPENDED → ACTIVE (o cambio de plan)
application/renew.use-case.ts                 ACTIVE → ACTIVE, +30 días desde max(period_end, now)
application/expire-subscriptions.use-case.ts  job diario
application/get-subscription.use-case.ts      lectura para el panel del negocio
application/list-history.use-case.ts          historial por negocio (negocio o admin)
infrastructure/prisma-subscription.repository.ts
infrastructure/subscription-exception.filter.ts
infrastructure/subscription.controller.ts      GET /businesses/me/subscription
infrastructure/admin-subscription.controller.ts POST /admin/businesses/:id/subscription/activate
                                               POST /admin/businesses/:id/subscription/renew
                                               POST /admin/businesses/:id/subscription/suspend
                                               GET  /admin/businesses/:id/subscription/history
subscriptions.module.ts
```

Regla de aislamiento: el `businessId` sale de la ruta solo para el admin (`SUPER_ADMIN`), y del `ActorContext` para el negocio. El cuerpo nunca decide el negocio.

### G.3 Frontend

- `apps/web/app/dashboard/negocio/page.tsx`: la tarjeta de suscripción muestra plan, estado, fin de prueba o fin de periodo, límite de publicaciones e historial (últimos 5 eventos).
- `apps/web/app/admin/suscripciones/page.tsx` (nueva): cola de negocios activables, formulario de activación (plan, importe confirmado, nota obligatoria), historial.
- `apps/web/app/admin/negocios/page.tsx`: columna de plan/estado de suscripción y enlace a la nueva pantalla.
- Reutiliza `Modal`, `Badge`, `StatCard`, `Banner`, `EmptyState`, `Field`, `inputStyles` de `modal.tsx`/`taxonomy-ui.tsx`. Sin componentes nuevos equivalentes.

### G.4 Semilla

- Planes: `FREE` (`trialMonths: 2`, `billingPeriodDays: null`, `maxListings: 10`), `BASE`/`PRO` (`0`, `30`, `30`/`50`).
- Sin usuarios de prueba en el seed de referencia (ver doc 24).

### G.5 Pruebas

- Unitarias de dominio: `addMonths` con 31 de enero, 29 de febrero, renovación anticipada y cambio de plan.
- Integración: activación `TRIALING → ACTIVE` (una sola fila de historial, `note` requerida), doble activación idempotente, renovación que suma 30 días, suspensión, vencimiento por job, lectura del historial por negocio ajeno → 404, `BUSINESS_OWNER` en endpoints de admin → 403.
- Regresión: E1 (8), E2 (11) y E3 (24) deben seguir en verde.

### G.6 Documentación

- Enmendar `docs/16` (columnas de `plan`), `docs/18` §4 (nota/actor en historial), `docs/15` §3 (fila de `plan`), y `docs/22` (D-29 ratificado como `priceCop`).

---

**Fin del documento.** No se modificó `schema.prisma`, ni seeds, ni migraciones, ni código, ni datos en esta etapa de planificación. **Estado: §B, §C y las decisiones D-31, D-35…D-39 aprobadas por el humano el 2026-11-17.** La ejecución de E4 espera el prompt de implementación.
