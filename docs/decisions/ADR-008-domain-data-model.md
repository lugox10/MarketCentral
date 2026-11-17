# ADR-008 — Modelo de datos del dominio y límites transaccionales

- **Estado:** **APROBADA**
- **Fecha:** 2026-11-12
- **Decisores:** Arquitectura de datos/backend; aprobación pendiente del responsable de producto
- **Ámbito:** modelo lógico del MVP ([15](../15-entity-relationship-model.md), [16](../16-data-dictionary.md), [17](../17-tenant-isolation-matrix.md), [19](../19-indexing-and-integrity.md))
- **Relacionados:** [ADR-001](ADR-001-modular-monolith.md), [ADR-003](ADR-003-multitenancy-strategy.md), [ADR-009](ADR-009-dynamic-listing-attributes.md), [ADR-010](ADR-010-subscriptions-and-entitlements.md)

---

## 1. Contexto

El MVP de MarketCentral necesita un modelo relacional que soporte: varias verticales con taxonomía propia, varios negocios por vertical, publicaciones con atributos distintos por sector, leads que pertenecen a un negocio y opcionalmente a una publicación, suscripciones con cobro manual y una capa de auditoría y eventos. El modelo debe convivir con la decisión de monolito modular ([ADR-001](ADR-001-modular-monolith.md)) y con el aislamiento en aplicación ([ADR-003](ADR-003-multitenancy-strategy.md)).

Las decisiones de negocio ya están cerradas en C-10 ([12 §8.1](../12-risks-and-open-decisions.md)): sin pasarela de pago, sin moderación previa, planes Free/Base/Pro, COP fijo, `city` obligatorio, un miembro por negocio, activación manual auditada. **Este ADR no las reabre**; define cómo se representan.

Restricciones técnicas: PostgreSQL 18 en Neon Free (São Paulo), Prisma 7 como ORM, `uuidv7()` disponible en el núcleo, `pg_trgm` y `jsonb_path_ops` disponibles.

---

## 2. Decisión

Se adopta un modelo **relacional normalizado con UUID v7, aislamiento por `business_id` y cinco agregados transaccionales**, con estas reglas:

1. **Tenant explícito.** `business_id` en toda tabla operativa; tablas de taxonomía, planes y usuarios son globales.
2. **Agregados:** `Business`, `Listing`, `Subscription`, `Lead`, `ModerationCase` (más `Plan` y `User` como agregados de configuración/cuenta). Cada agregado se modifica en una transacción; las referencias entre agregados son por id.
3. **Integridad estructural con FK compuestas:** la categoría pertenece a la vertical, la vertical está habilitada para el negocio y el lead pertenece al negocio de su publicación. Estas reglas **no** quedan solo en la aplicación.
4. **Claves auxiliares** (`UNIQUE (id, vertical_id)` en `category`, `UNIQUE (id, business_id)` en `listing`, `UNIQUE (business_id, vertical_id)` en `business_vertical`) para que las FK compuestas sean posibles. Son índices redundantes con la PK pero necesarios para la integridad.
5. **Sin polimorfismo donde hay FK viable:** `listing_image` es tabla de unión; `moderation_case` usa dos FK anulables con `CHECK` de exclusividad; `media_asset` no tiene `owner_type`.
6. **Borrado lógico** (`deleted_at`) en `business`, `listing`, `lead`, `media_asset`; físico solo en sesiones y tokens.
7. **Estados como enums de PostgreSQL**, cerrados por tipo de entidad ([18](../18-state-transition-matrix.md)).
8. **Auditoría y eventos en la misma transacción** que el cambio (`audit_entry`, `outbox_event`), ambos append-only.
9. **Sin tablas de catálogo:** el catálogo público es una proyección sobre `listing` y sus joins.
10. **Sin entidades de pasarela de pago** (C-10).
11. **Identificadores generados por la base:** `DEFAULT uuidv7()` (función nativa de PostgreSQL 18). Alternativa secundaria si el tooling de Prisma lo exige: `@default(uuid(7))` en el cliente. Ningún módulo construye identificadores a mano (**C-11.1 / D-01, APROBADA**).
12. **La visibilidad es un predicado, no un estado** (**C-11.4 / D-14, APROBADA**): `business.status='APPROVED' AND listing.status='PUBLISHED' AND subscription.status IN ('TRIALING','ACTIVE')`. Suspender o cerrar un negocio no archiva sus publicaciones en cascada; conservan su estado y solo se invisibilizan. El archivado masivo es una acción administrativa explícita (`CloseBusiness`), confirmada y auditada.
13. **Un solo `OWNER` por negocio se garantiza en el caso de uso** (**C-11.6**): al crear una membresía se verifica que no exista otro `OWNER` activo dentro de la misma transacción. **No** se crea trigger de exclusión en PostgreSQL. *Si en fase 2 se permiten múltiples `OWNER`, se evalúa un trigger de exclusión o un índice parcial por rol.*

---

## 3. Alternativas consideradas

| Alternativa | Descripción | Por qué se descarta |
|-------------|-------------|---------------------|
| **A. Modelo con tabla de catálogo materializada** | Copiar publicaciones visibles a `catalog_item` para consultas rápidas | Duplica inventario, exige sincronización y contradice el principio aprobado de una sola fuente de verdad ([ADR-004](ADR-004-public-marketplace-and-contact-model.md)) |
| **B. Modelo EAV completo** (valores en tabla) | `attribute_value` por fila | Muchos joins, validación débil, consultas de catálogo costosas ([ADR-009](ADR-009-dynamic-listing-attributes.md)) |
| **C. Un esquema por vertical** (schemas o bases separadas) | `prenderias.*`, `joyerias.*` | Multiplica migraciones, impide consultas transversales y complica el catálogo agregado |
| **D. Documento único por publicación** (JSONB con todo) | `listing` con `data jsonb` | Pierde integridad referencial, tipado y consultas por precio/estado |
| **E. Modelo normalizado con FK compuestas (elegido)** | Tablas tipadas + JSONB solo para atributos | Integridad en la base de datos, consultas simples, extensible por vertical |

---

## 4. Consecuencias

### 4.1 Positivas

- Las reglas de negocio críticas (vertical habilitada, categoría correcta, lead del mismo negocio) las impone la base de datos: un error de aplicación no las viola.
- Añadir una vertical no altera tablas centrales: solo inserta filas en `vertical`, `category` y `attribute_definition`.
- El catálogo no puede desincronizarse porque no tiene copia.
- La auditoría y el outbox comparten transacción con el cambio: no hay eventos de cambios que no ocurrieron.

### 4.2 Negativas y costos

| Costo | Detalle | Mitigación |
|-------|---------|------------|
| Índices auxiliares redundantes | `(id, vertical_id)`, `(id, business_id)` ocupan espacio | Aceptable a esta escala; se revisan si el volumen crece |
| Reglas que la base no puede validar | `is_enabled`, contenido de `attributes`, número de imágenes | Validación transaccional + triggers propuestos ([19 §6](../19-indexing-and-integrity.md)) |
| Aislamiento depende de la aplicación (sin RLS) | Una consulta sin filtro no se detiene en la BD | Repositorios por tenant, pruebas negativas, test de arquitectura ([17 §5](../17-tenant-isolation-matrix.md)) |
| Complejidad de FK compuestas en Prisma | Prisma las soporta, pero requiere `@@unique` explícitos y nombres de relación claros | Se documentan en [19 §2](../19-indexing-and-integrity.md); validación con `prisma validate` en el Prompt 03 |
| `business_id` repetido en tablas hijas | `lead` y `subscription` lo llevan además de su FK | Necesario para el filtro de tenant y para las FK compuestas; no es redundancia gratuita |

### 4.3 Impacto en otros módulos

| Módulo | Impacto |
|--------|---------|
| `Listings` | Valida atributos antes de persistir; no hay tabla de valores |
| `Leads` | El `business_id` se deriva del objeto, nunca del cuerpo |
| `Subscriptions` | Una fila por ciclo; índice parcial de vigencia ([ADR-010](ADR-010-subscriptions-and-entitlements.md)) |
| `PublicCatalog` | Consulta directa con índices de [19 §5](../19-indexing-and-integrity.md) |
| `Audit` / `Events` | Append-only, escritura obligatoria en la misma transacción |

---

## 5. Criterios para revisar esta decisión

1. El catálogo público necesita una proyección materializada para cumplir el p95 de 300 ms con más de 100 k publicaciones.
2. Se adopta RLS por requisito de un cliente o por auditoría de seguridad (reabre [ADR-003](ADR-003-multitenancy-strategy.md)).
3. Aparece la necesidad de que una publicación cambie de negocio o de vertical con historial.
4. Se incorpora una vertical con más de 15 atributos filtrables y los índices GIN dejan de ser suficientes.
5. Se introduce un segundo producto (subastas, servicios) que no encaje en `listing`.

---

## 6. Decisiones abiertas y cerradas

**Cerradas en C-11:**

| ID | Pregunta | Resolución |
|----|----------|------------|
| D-01 | ¿UUID v7 en aplicación o `uuidv7()` en PostgreSQL? | `DEFAULT uuidv7()`; alternativa `@default(uuid(7))` |
| D-13 | ¿`condition_code` configurable por vertical? | Enum fijo `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`, `POOR`; extra vía `condition_detail` |
| D-14 | ¿Archivado en cascada al suspender/cerrar negocio? | No automático; solo acción administrativa explícita |
| D-15 | ¿Trigger de `OWNER` único? | No; enforcement en el caso de uso de creación de membresía |
| D-16 | ¿`moderation_case` guarda resolución? | `decision`, `decided_by`, `decided_at`, `resolution_note` |

**Abierta (no bloquea el Prompt 03):** D-18 — particionado de `audit_entry` cuando supere 5 M de filas.

---

## 7. Historial

| Fecha | Cambio |
|-------|--------|
| 2026-11-12 | Creación del ADR como PROPUESTA, derivado del Prompt 02 |
| 2026-11-12 | **C-11:** D-01, D-13, D-14, D-15 y D-16 cerradas; UUID v7 por defecto en base; sin cascada de `ARCHIVED`; `OWNER` validado en aplicación; `moderation_case` con resolución |
| 2026-11-12 | **C-13:** el ADR pasa de PROPUESTA a **APROBADA** al aprobarse el roadmap (docs/22–23) y cerrarse D-19 |
