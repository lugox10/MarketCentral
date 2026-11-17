# MarketCentral — Documentación de planificación

**Etapa:** Prompt 01 — Definición del producto y arquitectura inicial; **Prompt 02 — Modelo de dominio y relacional** (docs 15–20 y ADR-008 a ADR-010); **Prompt 03 — Bootstrap verificado** (docs 21 y ADR-011); **Prompt 04 — Roadmap de implementación** (docs 22–23); **Preparación de E4 — datos, planes y sistema visual** (docs 24–25 y `ui-design-system.md`); **Implementación:** E1, E2 y E3 cerradas y versionadas (`main`, commit `54136ec`).
**Fecha:** 2026-11-17 (America/Bogota)
**Estado global:** documentación **para revisión humana**. Nada de este paquete está aprobado salvo lo marcado explícitamente como APROBADA.
**Decisiones de E4 cerradas el 2026-11-17:** D-31 (negocio sin suscripción), D-35 (`maxListings` en `plan`), D-36 (historial `subscription_activation`), D-37 (renovación conserva lo pagado), D-38 (`SUSPENDED` ≠ `EXPIRED`) y D-39 (`docs/ui-design-system.md` como guía canónica). Detalle en [25-e4-planning-and-decisions.md](25-e4-planning-and-decisions.md).
**Alcance:** documentación de planificación y decisiones. El repositorio ya contiene código de E1–E3
(API NestJS + web Next.js, esquema Prisma y tres migraciones); los documentos 01–20 describen el diseño
y 21–25 su estado real, la política de datos y la preparación de E4.

---

## 1. Qué contiene este directorio

| # | Documento | Contenido |
|---|-----------|-----------|
| 1 | [01-product-vision.md](01-product-vision.md) | Problema, propuesta de valor, actores, modelo de negocio, objetivos, supuestos y métricas. |
| 2 | [02-mvp-scope.md](02-mvp-scope.md) | Alcance incluido / excluido / futuro, dependencias entre funcionalidades y criterios de aceptación del MVP. |
| 3 | [03-system-architecture.md](03-system-architecture.md) | Contexto, contenedores, componentes, monorepo, arquitectura hexagonal aplicada y límites de despliegue. |
| 4 | [04-domain-overview.md](04-domain-overview.md) | Modelo de dominio conceptual, agregados, invariantes, relaciones e identificadores. |
| 5 | [05-modules-and-responsibilities.md](05-modules-and-responsibilities.md) | Ficha completa por módulo del backend: responsabilidad, datos, casos de uso, puertos, adaptadores, dependencias, eventos y pruebas. |
| 6 | [06-core-flows-and-state-machines.md](06-core-flows-and-state-machines.md) | Flujos funcionales, diagramas de secuencia y máquinas de estados con transiciones, actores y errores. |
| 7 | [07-security-and-multitenancy.md](07-security-and-multitenancy.md) | Identidad, sesiones, autorización, aislamiento multi-tenant, RLS evaluado, privacidad (Ley 1581) y pruebas negativas. |
| 8 | [08-non-functional-requirements.md](08-non-functional-requirements.md) | Requisitos no funcionales verificables con umbrales propuestos, SEO, accesibilidad, observabilidad y backups. |
| 9 | [09-integrations-and-n8n-readiness.md](09-integrations-and-n8n-readiness.md) | Eventos de dominio, outbox, webhooks, idempotencia, firma y encaje futuro de n8n. |
| 10 | [10-data-and-persistence-strategy.md](10-data-and-persistence-strategy.md) | Estrategia PostgreSQL + Prisma + Docker Compose, migraciones, índices, búsqueda, pooling y backups. |
| 11 | [11-public-marketplace-experience.md](11-public-marketplace-experience.md) | Portada, navegación por vertical, catálogo, búsqueda, filtros, detalle, perfil de negocio y contacto. |
| 12 | [12-risks-and-open-decisions.md](12-risks-and-open-decisions.md) | Registro de riesgos, preguntas abiertas priorizadas, inconsistencias detectadas y validaciones legales. |
| 13 | [13-glossary.md](13-glossary.md) | Glosario de negocio y de arquitectura. |
| 14 | [14-version-matrix-and-sources.md](14-version-matrix-and-sources.md) | Matriz de versiones verificadas, restricciones encontradas, fuentes oficiales y fecha de consulta. |
| 15 | [15-entity-relationship-model.md](15-entity-relationship-model.md) | Modelo entidad-relación, agregados, FK compuestas, límites transaccionales y consultas conceptuales. |
| 16 | [16-data-dictionary.md](16-data-dictionary.md) | Diccionario de datos: campo, tipo, nulabilidad, restricciones y sensibilidad por entidad. |
| 17 | [17-tenant-isolation-matrix.md](17-tenant-isolation-matrix.md) | Matriz de aislamiento: qué tabla es global o de negocio y qué regla de acceso aplica. |
| 18 | [18-state-transition-matrix.md](18-state-transition-matrix.md) | Estados, transiciones, actor, precondición, efecto, evento y error por entidad. |
| 19 | [19-indexing-and-integrity.md](19-indexing-and-integrity.md) | Claves, restricciones, índices, triggers propuestos, concurrencia y pruebas de integridad. |
| 20 | [20-data-retention-and-privacy.md](20-data-retention-and-privacy.md) | Minimización, consentimiento, retención, anonimización, derechos del titular y transferencia internacional. |
| 21 | [21-bootstrap-versions.md](21-bootstrap-versions.md) | Matriz de versiones del bootstrap, restricciones de entorno y workarounds de sandbox con su verificación. |
| 22 | [22-implementation-roadmap.md](22-implementation-roadmap.md) | Roadmap del MVP: 11 épicas, 60 historias de 1–2 días, contrato de API, reglas, pruebas, DoD y decisiones pendientes. |
| 23 | [23-epic-dependency-diagram.md](23-epic-dependency-diagram.md) | Diagramas de dependencia entre épicas e historias, camino crítico, olas de ejecución y puertas de aprobación. |
| 24 | [24-development-data-and-production-policy.md](24-development-data-and-production-policy.md) | Política de datos de desarrollo, separación de seed de referencia y demostración, y procedimiento de inicialización productiva. |
| 25 | [25-e4-planning-and-decisions.md](25-e4-planning-and-decisions.md) | Preparación de E4: estado de Git, modelo de `Plan` y duraciones, una suscripción actual con historial, negocios sin suscripción y cambios exactos de la épica. |
| UI | [ui-design-system.md](ui-design-system.md) | Sistema de diseño real extraído de E3: color, tipografía, espaciado, botones, formularios, modal, tarjetas, badges, estados, responsive y accesibilidad. |
| D | [decisions/README.md](decisions/README.md) | Índice y plantilla de los ADR. |
| D1 | [decisions/ADR-001-modular-monolith.md](decisions/ADR-001-modular-monolith.md) | Monolito modular como forma de despliegue y límites funcionales. |
| D2 | [decisions/ADR-002-hexagonal-architecture.md](decisions/ADR-002-hexagonal-architecture.md) | Arquitectura hexagonal pragmática dentro de cada módulo. |
| D3 | [decisions/ADR-003-multitenancy-strategy.md](decisions/ADR-003-multitenancy-strategy.md) | Multi-tenancy por membresías y contexto de negocio resuelto en servidor. |
| D4 | [decisions/ADR-004-public-marketplace-and-contact-model.md](decisions/ADR-004-public-marketplace-and-contact-model.md) | Catálogo agregado sin duplicar inventario, WhatsApp externo y Lead persistido. |
| D5 | [decisions/ADR-005-postgresql-prisma-and-docker.md](decisions/ADR-005-postgresql-prisma-and-docker.md) | PostgreSQL + Prisma + Docker Compose local y disciplina de migraciones. |
| D6 | [decisions/ADR-006-production-database-provider.md](decisions/ADR-006-production-database-provider.md) | Proveedor de PostgreSQL en producción — **APROBADA**: Neon Free (`aws-sa-east-1`), escalado a Launch. |
| D7 | [decisions/ADR-007-events-and-n8n-readiness.md](decisions/ADR-007-events-and-n8n-readiness.md) | Eventos de dominio, outbox y webhooks desacoplados de n8n. |
| D8 | [decisions/ADR-008-domain-data-model.md](decisions/ADR-008-domain-data-model.md) | Agregados, FK compuestas y límites transaccionales del modelo de datos. **APROBADA** (C-11). |
| D9 | [decisions/ADR-009-dynamic-listing-attributes.md](decisions/ADR-009-dynamic-listing-attributes.md) | Atributos dinámicos: definiciones tipadas + JSONB validado, con `condition_code` como enum fijo. **APROBADA** (C-13). |
| D10 | [decisions/ADR-010-subscriptions-and-entitlements.md](decisions/ADR-010-subscriptions-and-entitlements.md) | Plan + PlanEntitlement, cinco estados de suscripción, cobro manual e idempotencia (R-32). **APROBADA** (C-14). |
| D11 | [decisions/ADR-011-bootstrap-versions.md](decisions/ADR-011-bootstrap-versions.md) | Versiones del bootstrap, workarounds de sandbox y su verificación. **APROBADA** (C-13). |

---

## 2. Convención de etiquetas

Toda decisión relevante lleva una de estas tres etiquetas. No se mezclan.

| Etiqueta | Significado | Quién la cambia |
|----------|-------------|-----------------|
| **APROBADA** | Restricción o decisión dada explícitamente por el cliente en el brief, o consecuencia directa e inevitable de ella. Se puede diseñar encima. | Solo el cliente puede revocarla. |
| **PROPUESTA** | Recomendación del arquitecto, justificada y con alternativas descartadas. No habilita implementación hasta aprobación. | Cliente / responsable de producto. |
| **PENDIENTE** | Requiere información, presupuesto, verificación técnica o concepto externo (legal, contable, proveedor). Bloquea lo que dependa de ella. | Cliente con apoyo del arquitecto. |

Convenciones adicionales:

- **SUPUESTO** — hipótesis explícita adoptada para no bloquear la documentación. Tiene impacto declarado y debe validarse.
- **PREGUNTA** — ambigüedad registrada. No bloquea el documento; bloquea la fase que la necesite.
- Cada decisión incluye motivo, alternativas descartadas y consecuencias. Si falta alguno de los tres, el documento está incompleto.
- Los identificadores de software (módulos, entidades, estados, tablas, eventos, rutas) se escriben en inglés. La prosa va en español técnico.

---

## 3. Distinción de hechos, propuestas y supuestos

- **Hecho verificado** — comprobado contra fuente oficial en la fecha indicada (ver [14-version-matrix-and-sources.md](14-version-matrix-and-sources.md)).
- **Inferencia** — deducción razonable a partir de hechos, marcada como tal.
- **Propuesta** — diseño recomendado pendiente de aprobación.
- **Supuesto** — dado por cierto sin verificación, con impacto declarado.

Ningún dato de negocio (precios de planes, comisiones, volúmenes de mercado, número de prenderías) se afirma como hecho: son propuestas o pendientes.

---

## 4. Reglas que atraviesan toda la documentación

1. El **catálogo público consulta publicaciones existentes**; nunca copia ni duplica inventario.
2. **WhatsApp** es un contacto externo; abrirlo no crea Lead. El **formulario web** sí persiste un `Lead`.
3. El **pago de artículos ocurre fuera de la plataforma**. El cobro de **suscripciones** es un flujo separado.
4. **n8n es una integración futura opcional**; el dominio funciona si n8n no existe.
5. **Monolito modular** (despliegue y límites) y **arquitectura hexagonal** (dirección de dependencias dentro de cada módulo) se complementan; no son alternativas.
6. El **backend NestJS es el único** que accede a la base de datos de negocio. Next.js no usa Prisma ni PostgreSQL.
7. La **autenticación y autorización** viven en NestJS. No se adoptan Supabase Auth, Storage, Data API ni RLS como decisión implícita.
8. Sin microservicios ni Kubernetes en el MVP.

---

## 5. Documentos que deliberadamente NO existen todavía

- Contratos OpenAPI definitivos y DTOs.
- Wireframes.
- Plan de despliegue, CI/CD y runbooks operativos.
- Aprobación humana del roadmap (docs 22–23) y cierre de las decisiones D-19…D-28.
- `.superdesign/design-system.md`: requiere el CLI de Superdesign instalado y autenticado. La guía canónica derivada del código es [ui-design-system.md](ui-design-system.md).

El modelo entidad-relación y el diccionario de datos ya existen (docs 15–16); lo que falta es su
traducción a Prisma y su migración, que se hace por historia según el roadmap.
El esquema Prisma existe parcialmente: `apps/api/prisma/schema.prisma` cubre E1 (identidad),
E2 (negocios, membresías, planes y suscripción) y E3 (taxonomía), con una migración versionada por épica.
