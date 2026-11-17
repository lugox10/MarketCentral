# 13 — Glosario

**Estado:** documento para revisión · **Fecha:** 2026-11-12 · **Fase:** planificación (Prompt 01)

> Los términos de negocio se presentan en español; los identificadores de software, en inglés. Cuando un término tiene un significado técnico distinto al coloquial, se indica.

---

## 1. Negocio y producto

| Término | Definición |
|---------|-----------|
| **Marketplace** | Plataforma que agrupa la oferta de muchos negocios independientes y permite descubrirla y contactarla. En este proyecto el marketplace es **agregado por vertical**, no un e-commerce único. |
| **Vertical** | Sector comercial con reglas, categorías y atributos propios (p. ej. Prenderías, Joyerías, Zapaterías). Una publicación pertenece a **una sola** vertical. |
| **Prendería** | Negocio de compraventa de ropa, calzado y accesorios de segunda mano. Primera vertical candidata en Medellín y área metropolitana. |
| **Negocio** (`Business`) | Entidad que publica artículos y administra su operación en la plataforma. Tiene perfil público, miembros, suscripción y verticales habilitadas. |
| **Membresía** (`Membership`) | Vínculo entre un usuario y un negocio, con un rol (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`). En el MVP cada negocio tiene **un solo miembro (`OWNER`)**; los demás roles quedan modelados para fases posteriores. |
| **Publicación** (`Listing`) | Oferta concreta de un artículo de un negocio. Tiene estado, categoría, atributos, imágenes y precio. |
| **Catálogo agregado** | Vista pública que **consulta las publicaciones existentes** de varios negocios de una vertical. No almacena ni duplica inventario. |
| **Inventario** | Conjunto de publicaciones de un negocio. En el MVP equivale a sus publicaciones; no hay stock numérico separado (**PENDIENTE** si se requiere). |
| **Lead** | Contacto enviado por un comprador mediante el **formulario web**, persistido y asociado a un negocio (y opcionalmente a una publicación). |
| **Contacto por WhatsApp** | Acción que abre una conversación externa con el negocio. **No** crea Lead ni se registra como contacto en la plataforma. |
| **Suscripción** (`Subscription`) | Contrato recurrente entre un negocio y la plataforma que otorga acceso y límites según un plan. Es un flujo **separado** del pago de artículos. Estados: `TRIALING`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `CANCELLED` ([18 §4](18-state-transition-matrix.md); el alta crea el plan Free en `TRIALING`). |
| **Plan** (`Plan`) | Conjunto de límites y capacidades que puede contratar un negocio. En el MVP: Free (2 meses, 10 publicaciones), Base (30, 30.000 COP/mes), Pro (50, 50.000 COP/mes). |
| **Entitlement** (`PlanEntitlement`) | Par clave/valor que materializa un límite del plan (p. ej. `max_active_listings = 50`), para que sea configurable sin migración. Se evalúa en backend. |
| **Activación manual** | Alta de una suscripción de pago hecha por un administrador tras recibir el cobro por transferencia/Nequi. Exige `activatedByAdminId` y `activationNote`, y queda auditada. |
| **Moderación** | Revisión de negocios, publicaciones o denuncias por parte del equipo de plataforma, con decisión registrada. |
| **Denuncia** (`Report`) | Aviso de un usuario sobre contenido presuntamente indebido. |
| **Estado de conservación** | Condición del artículo de segunda mano (`Nuevo`, `Como nuevo`, `Usado`). Valores configurables por vertical. |
| **Artículo vendido** | Publicación marcada como vendida por el negocio; deja de ser visible en el catálogo. La venta ocurre **fuera** de la plataforma. |

---

## 2. Arquitectura

| Término | Definición |
|---------|-----------|
| **Monolito modular** | Una sola unidad despliegable (API) organizada en módulos con límites claros y dependencias explícitas. No implica microservicios. |
| **Arquitectura hexagonal (Ports & Adapters)** | Forma de organizar dependencias: el núcleo (dominio + aplicación) define contratos (puertos) y la infraestructura los implementa (adaptadores). Las dependencias apuntan hacia el núcleo. |
| **Puerto** (`Port`) | Interfaz que declara lo que el núcleo necesita (salida) o expone (entrada). Vive en el núcleo, no en infraestructura. |
| **Adaptador** (`Adapter`) | Implementación concreta de un puerto: repositorio Prisma, cliente S3, pasarela de pago, publicador de eventos. |
| **Caso de uso** (`Use case`) | Operación de aplicación que orquesta reglas, transacciones y puertos. No conoce HTTP ni SQL. |
| **Entidad de dominio** | Objeto con identidad y reglas propias, independiente de frameworks. |
| **Objeto de valor** (`Value object`) | Concepto inmutable sin identidad propia (p. ej. `Money`, `PhoneNumber`, `Slug`). |
| **Agregado** (`Aggregate`) | Conjunto de entidades que se modifican como una unidad transaccional, con una raíz. |
| **Invariante** | Condición que siempre debe cumplirse en el dominio (p. ej. "una publicación publicada tiene al menos una imagen procesada"). |
| **DTO** | Objeto de transferencia con el contrato de entrada/salida de la API. No es una entidad de dominio. |
| **ActorContext** | Contexto de seguridad resuelto por el servidor: usuario, negocio activo, membresía y rol. Base de toda autorización. |
| **Repositorio** | Puerto de persistencia que abstrae el acceso a datos del dominio. |
| **Outbox** | Tabla donde se registran eventos en la misma transacción que el cambio de datos, para publicarlos después de forma confiable. |
| **Idempotencia** | Propiedad por la que repetir una operación produce el mismo resultado sin efectos duplicados. |
| **Keyset pagination** | Paginación por cursor basada en el último registro visto, en lugar de `OFFSET`; más estable y eficiente. |
| **SSR / SSG / ISR** | Renderizado en servidor / generación estática / regeneración incremental en Next.js. |
| **Server Component / Client Component** | Componentes de React ejecutados en servidor (por defecto) o en el navegador (`"use client"`). |
| **OpenAPI** | Especificación del contrato REST de la API; fuente del cliente tipado del frontend. |
| **Feature flag** | Interruptor de configuración para activar/desactivar comportamiento sin desplegar. |
| **RLS** (`Row Level Security`) | Políticas de PostgreSQL que restringen filas según el rol/contexto de la sesión de base de datos. |
| **Tenant** | Inquilino lógico de datos. En este proyecto, el `Business` es el tenant principal. |
| **PII** | Información personal identificable. |
| **HMAC** | Código de autenticación basado en hash con clave; se usa para firmar webhooks. |
| **CDN** | Red de distribución de contenido para servir imágenes y páginas estáticas cerca del usuario. |
| **RPO / RTO** | Pérdida máxima de datos aceptable / tiempo máximo de recuperación del servicio. |
| **ADR** | Architecture Decision Record: registro de una decisión con contexto, alternativas y consecuencias. |

---

## 3. Términos técnicos del stack

| Término | Definición |
|---------|-----------|
| **Monorepo** | Un repositorio con varias aplicaciones y paquetes (`web`, `api`, `worker`, `packages/*`). |
| **Turborepo** | Orquestador de tareas y caché para monorepos. |
| **pnpm workspace** | Gestión de dependencias y paquetes del monorepo con enlaces simbólicos. |
| **Prisma Migrate** | Herramienta de migraciones versionadas de Prisma. |
| **Pooler** | Componente que multiplexa conexiones a PostgreSQL. En el MVP: PgBouncer de Neon en modo *transaction* (host `-pooler`). |
| **Seeding** | Carga de datos iniciales o de prueba en una base de datos. |
| **E2E** | Prueba de extremo a extremo que recorre un flujo completo en el navegador. |
| **Smoke test** | Prueba mínima que verifica que el sistema arranca y responde. |

---

## 4. Convenciones de nombres en el proyecto

| Concepto | Nombre canónico |
|----------|-----------------|
| Negocio | `Business` / `businessId` |
| Usuario | `User` |
| Membresía | `Membership` |
| Publicación | `Listing` |
| Lead | `Lead` |
| Suscripción | `Subscription` |
| Plan | `Plan` |
| Límite del plan | `PlanEntitlement` |
| Vertical | `Vertical` |
| Categoría | `Category` |
| Definición de atributo | `AttributeDefinition` |
| Valor de atributo | `attributes` (JSONB en `Listing`) |
| Archivo/imagen | `MediaAsset` |
| Denuncia | `Report` |
| Caso de moderación | `ModerationCase` |
| Evento de dominio | `DomainEvent`, tabla `outbox_event` |
