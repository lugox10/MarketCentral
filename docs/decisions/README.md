# Decisiones arquitectónicas (ADR)

**Última actualización:** 2026-11-12 · **Fase:** planificación (Prompt 01)

Este directorio registra las decisiones que afectan la estructura del sistema, sus límites o sus contratos. Una decisión no es un deseo: tiene contexto, alternativas evaluadas, estado explícito y consecuencias.

---

## 1. Convenciones

| Etiqueta | Significado |
|----------|-------------|
| **APROBADA** | Aceptada para el MVP por la persona responsable del proyecto. Se puede implementar. |
| **PROPUESTA** | Recomendación técnica documentada; requiere aprobación humana explícita antes de implementarse. |
| **PENDIENTE** | Sin decisión. No se implementa nada que dependa de ella sin un supuesto escrito. |
| **RECHAZADA** | Evaluada y descartada; se conserva para evitar reabrirlas sin argumentos nuevos. |
| **SUSTITUIDA** | Reemplazada por otro ADR; se indica cuál. |

**Reglas**

1. Un ADR no se edita para cambiar su decisión: se crea uno nuevo que lo sustituye.
2. Las correcciones editoriales (typos, enlaces) sí se permiten.
3. Toda propuesta que cambie límites de módulos, dependencias o contratos requiere ADR.
4. Los ADR **PENDIENTES** deben resolverse o convertirse en supuesto explícito antes de la fase que los necesita.

---

## 2. Índice

| ADR | Título | Estado | Fecha | Impacto |
|-----|--------|--------|-------|---------|
| [ADR-001](ADR-001-modular-monolith.md) | Monolito modular con dos aplicaciones | **APROBADA** | 2026-11-12 | Despliegue, límites |
| [ADR-002](ADR-002-hexagonal-architecture.md) | Arquitectura hexagonal pragmática en el backend | **APROBADA** | 2026-11-12 | Organización interna, dependencias |
| [ADR-003](ADR-003-multitenancy-strategy.md) | Multi-tenancy por membresías y aislamiento en aplicación | **APROBADA** | 2026-11-12 | Seguridad, datos, autorización |
| [ADR-004](ADR-004-public-marketplace-and-contact-model.md) | Catálogo agregado y modelo de contacto | **APROBADA** | 2026-11-12 | Producto, catálogo, leads |
| [ADR-005](ADR-005-postgresql-prisma-and-docker.md) | PostgreSQL + Prisma + Docker en local | **APROBADA** | 2026-11-12 | Persistencia, migraciones |
| [ADR-006](ADR-006-production-database-provider.md) | Proveedor de PostgreSQL de producción | **APROBADA** — Neon Free (MVP) | 2026-11-12 | Infraestructura, costos, backups |
| [ADR-007](ADR-007-events-and-n8n-readiness.md) | Eventos de dominio y preparación para n8n | **PROPUESTA** | 2026-11-12 | Integraciones, outbox |
| [ADR-008](ADR-008-domain-data-model.md) | Modelo de datos del dominio y límites transaccionales | **APROBADA** | 2026-11-12 | Modelo ER, agregados, integridad |
| [ADR-009](ADR-009-dynamic-listing-attributes.md) | Atributos dinámicos: JSONB validado | **APROBADA** | 2026-11-12 | Publicaciones, filtros, catálogo |
| [ADR-010](ADR-010-subscriptions-and-entitlements.md) | Suscripciones, entitlements y cobro manual | **APROBADA** | 2026-11-12 | Planes, límites, activación (R-32) |
| [ADR-011](ADR-011-bootstrap-versions.md) | Versiones y verificación del bootstrap | **APROBADA** | 2026-11-12 | Toolchain, entorno, CI |

---

## 3. Decisiones que no requieren ADR propio (registradas en documentos)

Estas decisiones están aprobadas o propuestas en el cuerpo documental y se listan aquí para trazabilidad:

| Decisión | Estado | Documento |
|----------|--------|-----------|
| Autenticación y autorización en NestJS (no en Next.js ni en Supabase) | APROBADA | [07](../07-security-and-multitenancy.md) |
| Nombre del producto: **MarketCentral**; cada negocio conserva su marca (Q-01, C-10) | APROBADA | [12 §8](../12-risks-and-open-decisions.md) |
| **Sin pasarela de pago**: cobro manual (transferencia/Nequi) y activación por admin; sin `PaymentProviderAccount` ni `PaymentWebhookEvent` (Q-06, C-10) | APROBADA | [12 §8](../12-risks-and-open-decisions.md) |
| **Sin moderación previa**: `Business` `APPROVED`/`SUSPENDED`; `Listing` `DRAFT`/`PUBLISHED`/`PAUSED`/`SOLD`/`ARCHIVED`; moderación reactiva ante denuncia (Q-07, C-10) | APROBADA | [12 §8](../12-risks-and-open-decisions.md) |
| Planes Free 10 / Base 30 / Pro 50 publicaciones; `Plan` + `PlanEntitlement`; 1 miembro y 5 imágenes por publicación en el MVP (Q-02/Q-03, C-10) | APROBADA | [12 §8](../12-risks-and-open-decisions.md) |
| Precio en **COP fijo** con `CHECK`; sin multi-moneda (Q-15, C-10) | APROBADA | [10 §3](../10-data-and-persistence-strategy.md) |
| `Business.city` obligatorio (10 municipios del Valle de Aburrá) + `addressLine` opcional; `Listing` hereda; `idx_business_city` (Q-16, C-10) | APROBADA | [10 §3](../10-data-and-persistence-strategy.md) |
| T&C y Política de Privacidad con plantilla estándar; sin abogado dedicado ni RNBD en el MVP (L-01/L-02, C-10) | APROBADA | [12 §8](../12-risks-and-open-decisions.md) |
| Sesión server-side con cookie HttpOnly (no JWT de larga vida) | APROBADA | [07 §4](../07-security-and-multitenancy.md) |
| Catálogo público consulta publicaciones existentes, sin duplicar inventario | APROBADA | [11](../11-public-marketplace-experience.md) |
| WhatsApp = contacto externo; formulario = Lead persistido | APROBADA | [11 §10](../11-public-marketplace-experience.md) |
| Pago de artículos fuera de la plataforma; sin checkout de productos | APROBADA | [01 §4](../01-product-vision.md) |
| n8n no es dependencia de la lógica de negocio | APROBADA | [09](../09-integrations-and-n8n-readiness.md) |
| Atributos configurables vía definiciones tipadas + JSONB validado | PROPUESTA | [10 §5](../10-data-and-persistence-strategy.md) |
| Sin RLS en el MVP (aislamiento en aplicación) | PROPUESTA | [07 §6](../07-security-and-multitenancy.md) |
| Prisma 7.10.1 fijado; migración a 8 tras GA | PROPUESTA | [14](../14-version-matrix-and-sources.md) |
| Node.js 24 LTS (no 26) por rango de Prisma 7 | PROPUESTA | [14 §2](../14-version-matrix-and-sources.md) |
| MFA para roles de plataforma | PROPUESTA | [07 §4.5](../07-security-and-multitenancy.md) |

---

## 4. Cómo se aprueba un ADR

1. El autor redacta el ADR en estado **PROPUESTA** (o **PENDIENTE** si falta información).
2. Se revisa en una sesión de arquitectura con quien tenga autoridad sobre el alcance.
3. Se registra la aprobación con fecha y responsable en el propio ADR.
4. Si se rechaza, se documenta el motivo y no se borra el ADR.
5. La implementación no comienza sobre un ADR **PENDIENTE** sin supuesto escrito y aceptado.

---

## 5. Estado global de la arquitectura

- **Forma:** monolito modular desplegable como `web` + `api` + `worker`, con arquitectura hexagonal pragmática dentro de los módulos con reglas de negocio.
- **Persistencia:** PostgreSQL único, acceso exclusivo desde `api`/`worker`, Prisma como ORM y migraciones.
- **Multi-tenancy:** `Business` como tenant; membresías usuario–negocio con roles; aislamiento en la capa de aplicación.
- **Integraciones:** eventos por outbox; n8n como consumidor futuro; ningún acoplamiento del dominio.
- **Estado del proveedor de producción:** **APROBADA** — Neon Free en `aws-sa-east-1` (São Paulo), con escalado a Launch ([ADR-006](ADR-006-production-database-provider.md)). Queda **PENDIENTE** la región de hosting de `api`/`web` y la validación legal de transferencia internacional (L-03).
- **Alcance del MVP (C-10, 2026-11-12):** sin pasarela de pago (cobro manual activado por admin), sin moderación previa (reactiva ante denuncia), un solo miembro por negocio, precios en COP fijo, ubicación por municipio del Valle de Aburrá. Esto **reduce** el modelo: desaparecen las tablas de proveedor de pago, las facturas y los estados `PENDING_REVIEW`/`REJECTED`.
- **Bloqueantes del Prompt 02:** **ninguno**. Las decisiones de negocio están cerradas; las preguntas restantes (Q-08, Q-14, Q-20, Q-21, Q-22) tienen supuesto escrito y no afectan al modelo conceptual.
- **Modelo de datos (Prompt 02, 2026-11-12; cerrado en C-11 y aprobado en C-13):** agregados `Business`, `Listing`, `Subscription`, `Lead` y `ModerationCase`; UUID v7 con `DEFAULT uuidv7()` ([ADR-008](ADR-008-domain-data-model.md), **APROBADA**); FK compuestas para garantizar vertical habilitada, categoría de la vertical y pertenencia del lead; atributos en JSONB validado ([ADR-009](ADR-009-dynamic-listing-attributes.md), **APROBADA**); `Plan` + `PlanEntitlement` con cobro manual, cinco estados e idempotencia ([ADR-010](ADR-010-subscriptions-and-entitlements.md), **APROBADA**).
- **Bootstrap (Prompt 03, verificado en entorno real):** versiones fijadas y workarounds de sandbox documentados en `docs/21`; los workarounds se eliminaron y el build pasa sin ellos ([ADR-011](ADR-011-bootstrap-versions.md), **APROBADA**).
- **Roadmap (Prompt 04, aprobado por el humano en C-13):** 11 épicas, 60 historias, 85 días estimados, con E4 (suscripciones) antes de E5 (publicaciones) ([docs/22](../22-implementation-roadmap.md), [docs/23](../23-epic-dependency-diagram.md)).
- **Cierres de C-11 (2026-11-12):** D-01 (UUID con `uuidv7()`), C-01 (`TRIALING`/`ACTIVE`/`SUSPENDED`/`EXPIRED`/`CANCELLED`), D-13 (`condition_code` enum fijo), D-14 (sin cascada de archivado; visibilidad como predicado), D-16 (`moderation_case.decision`), trigger de `OWNER` (enforcement en caso de uso). Única decisión abierta: **D-18** (particionado de `audit_entry`), que no bloquea el Prompt 03.
