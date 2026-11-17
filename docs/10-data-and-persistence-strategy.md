# 10 — Datos y estrategia de persistencia

**Estado:** documento para revisión · **Fecha:** 2026-11-12 · **Fase:** planificación (Prompt 01)

> Este documento fija **criterios y convenciones**. No contiene el esquema físico, ni DDL, ni `schema.prisma`, ni migraciones: eso corresponde al Prompt 02. Las estructuras mencionadas son conceptuales.

---

## 1. Motor y topología

| Aspecto | Definición | Estado |
|---------|-----------|--------|
| Motor | PostgreSQL 18.x (18.7 es el minor actual al 2026-11-12) | APROBADA (motor); versión exacta a fijar en Prompt 02 |
| ORM | Prisma ORM 7.10.1 (GA) fijado con versión exacta | PROPUESTA |
| Acceso | Solo `api` (NestJS) y `worker` | APROBADA |
| `web` | Sin conexión a PostgreSQL ni a Prisma | APROBADA |
| Local | Docker Compose con PostgreSQL 18, volumen persistente, healthcheck | APROBADA |
| Producción | **Neon Free** en `aws-sa-east-1` (São Paulo) → [ADR-006](decisions/ADR-006-production-database-provider.md) | APROBADA |
| Pooling | Endpoint *pooled* de Neon (PgBouncer en modo transacción) para runtime; endpoint directo para migraciones | PROPUESTA (validar en *spike*) |

**Nota sobre Prisma 8:** al 2026-11-12 el tag `latest` del CLI apunta a `8.0.0-rc.33` mientras `@prisma/client` estable es `7.10.1`. Se debe **fijar versión exacta** y no usar `latest` en CI. Ver [14-version-matrix](14-version-matrix-and-sources.md).

---

## 2. Propiedad de datos por módulo

Cada tabla tiene **un módulo dueño**; otro módulo la lee por API o por puerto, no por SQL directo.

| Módulo | Datos que gobierna |
|--------|--------------------|
| Auth | Credenciales (hash), sesiones, tokens de verificación/recuperación, intentos de acceso |
| Users | Perfil de usuario, preferencias, estado de la cuenta |
| Businesses | Negocios, perfiles públicos, membresías, invitaciones, verticales habilitadas |
| Verticals / Categories / Attributes | Verticales, categorías, definiciones de atributos y sus opciones |
| Listings | Publicaciones, valores de atributos, historial de estados, historial de slugs |
| Media | Metadatos de archivos, estado de procesamiento, relación con publicación |
| PublicCatalog | **Sin datos propios**; solo lecturas y caché derivada |
| Leads | Leads, notas internas, historial de estado |
| Subscriptions | Planes, suscripciones, periodos, entitlements |
| Billing | **Solo en el MVP:** registro de activaciones manuales de suscripción (quién, cuándo, nota) y su auditoría. Sin sesiones de checkout ni eventos de proveedor (Q-06, C-10) |
| Moderation | Casos, decisiones, denuncias |
| Notifications | Plantillas, envíos, estado de entrega |
| Audit | Registro de auditoría (solo inserción) |
| Integrations / Events | Outbox, eventos procesados, suscriptores de webhook (fase 2) |

**Regla:** `PublicCatalog` nunca escribe en tablas de `Listings`; si necesita un dato derivado (p. ej. contador), lo calcula o lo consume por evento en su propio espacio.

---

## 3. Convenciones de modelado

| Tema | Convención | Motivo |
|------|-----------|--------|
| Identificadores | UUID v7 (**PROPUESTA**, D-01): generado en la aplicación **o** con `uuidv7()` nativo de PostgreSQL 18 (`https://www.postgresql.org/docs/18/functions-uuid.html`); a decidir en el Prompt 02 | No secuenciales (no enumerables) y ordenables por tiempo (mejor localidad de índice que UUID v4) |
| Claves naturales | Slugs únicos por ámbito (`verticalId + slug`, `businessId + slug`) | URLs legibles y estables |
| Nombres | `camelCase` en Prisma, `snake_case` en tablas/columnas con `@@map`/`@map` | Convención SQL y comodidad en TS |
| Fechas | `timestamptz` en UTC; la zona se resuelve en presentación | Evita ambigüedad |
| Dinero | Entero en **unidades menores** (pesos sin decimales) + `price_currency char(3) DEFAULT 'COP'` con `CHECK (price_currency = 'COP')` | Moneda única aprobada (Q-15, C-10); sin errores de coma flotante |
| Ubicación | `business.city` (enum del catálogo de 10 municipios del Valle de Aburrá, obligatorio) + `business.address_line` (texto, opcional). `listing` **no** duplica la ubicación: se resuelve por `business_id` | Q-16 (C-10); evita que la publicación y el negocio se contradigan |
| Booleanos | `is_*` / `has_*` con default explícito | Legibilidad |
| Enumeraciones | Enum de PostgreSQL para estados cerrados y estables | Validación en BD y tipos en Prisma |
| Borrado | Lógico (`deleted_at`) en entidades con historial o referencias; físico en datos efímeros (sesiones, tokens) | Integridad y auditoría |
| Auditoría base | `created_at`, `updated_at` en toda entidad mutable | Trazabilidad mínima |
| Concurrencia | Columna `version` en agregados con edición concurrente (**PROPUESTA**) | Evitar pérdidas por actualización |

---

## 4. Restricciones como contrato

Aunque la aplicación valide, la base de datos impone lo que **nunca** puede violarse:

- **Únicos:** email de usuario (normalizado), slug por ámbito, `membership(user_id, business_id)`, `business_vertical(business_id, vertical_id)`, `plan_entitlement(plan_id, key)`.
- **Claves foráneas** con `ON DELETE RESTRICT` por defecto; `CASCADE` solo en dependencias reales (p. ej. los `plan_entitlement` al borrar un plan sin suscripciones).
- **Checks:** precio > 0; `price_currency = 'COP'`; rangos de fechas coherentes (`period_end > period_start`); estados válidos por tipo; `activation_note` y `activated_by_admin_id` obligatorios cuando `status = 'ACTIVE'` y la activación fue manual.
- **Índices únicos parciales:** una sola suscripción viva por negocio (`WHERE status IN ('TRIALING','ACTIVE')`); el `OWNER` único se valida en el caso de uso, **sin** índice ni trigger (C-11.6).
- **Índices del catálogo:** `idx_business_city` sobre `business (city) WHERE deleted_at IS NULL`, más los índices de visibilidad y búsqueda de [11 §6](11-public-marketplace-experience.md).
- **Timestamps de negocio** no nulos cuando el estado lo exige (`published_at` si `status = PUBLISHED`).

---

## 5. Atributos configurables: comparación de alternativas

**Requisito:** representar atributos distintos por vertical/categoría sin columnas específicas por sector.

### 5.1 Alternativas

| # | Alternativa | Descripción | Ventajas | Desventajas |
|---|-------------|-------------|----------|-------------|
| A | Columnas específicas por vertical | Tabla ancha o tabla por vertical | Consultas simples y tipadas | Migración por cada vertical nueva; inviable multi-vertical |
| B | EAV puro | Tabla `attribute_value(entity_id, attribute_id, value_text)` | Máxima flexibilidad | Muchos joins; validación y tipado débiles; consultas complejas y lentas |
| C | Definiciones tipadas + valores en JSONB | `AttributeDefinition` (tipo, obligatorio, opciones, filtrable) + `Listing.attributes` JSONB validado | Flexible, una tabla, buen soporte de índices GIN | Validación en aplicación; riesgo de datos inconsistentes si se salta la capa |
| D | Híbrido: JSONB + tabla de valores para atributos filtrables | JSONB como fuente + proyección de atributos indexables | Búsqueda rápida en filtros frecuentes | Duplicación y sincronización; complejidad operativa |
| E | Documento externo (MongoDB) | Atributos en otra base | Esquema libre | Segundo motor, transacciones cruzadas, más operación |

### 5.2 Evaluación

| Criterio | A | B | C | D | E |
|----------|---|---|---|---|---|
| Multi-vertical | ❌ | ✅ | ✅ | ✅ | ✅ |
| Validación | ✅ | ⚠️ | ✅ (app) | ✅ | ⚠️ |
| Consulta/filtros | ✅ | ⚠️ | ✅ (GIN) | ✅✅ | ✅ |
| Complejidad operativa | Baja | Media | Baja | Alta | Alta |
| Riesgo de inconsistencia | Bajo | Alto | Medio | Medio | Medio |
| Costo de cambio | Alto | Medio | Bajo | Alto | Alto |

### 5.3 Recomendación

**Alternativa C — definiciones tipadas + JSONB validado**, con estas condiciones:

1. `AttributeDefinition` declara `key`, `dataType` (`TEXT`, `NUMBER`, `BOOLEAN`, `SELECT`, `MULTISELECT`, `DATE`), `required`, `filterable`, `options`, `validation` (min/max, regex acotado), `verticalId` y `categoryId` opcional (herencia vertical → categoría).
2. `Listings` valida **en el caso de uso** contra las definiciones vigentes antes de persistir; la base de datos no puede validar el contenido semántico de JSONB, por lo que la aplicación es la única puerta de escritura.
3. Los valores se guardan normalizados (números como número, booleanos como booleano, selecciones como `key` de opción) para permitir filtros e índices.
4. Se indexa con GIN (`jsonb_path_ops`) y con índices de expresión solo para los atributos marcados `filterable` y con uso demostrado.
5. Cambiar el tipo de un atributo con datos existentes requiere migración de datos y ventana de compatibilidad; se prohíbe el cambio silencioso.
6. `filterable` es una decisión de producto, no un automatismo: cada atributo filtrable añade costo de índice y de facetado.

**Consecuencias:** se acepta validación en aplicación (mitigada con pruebas y una única ruta de escritura) a cambio de flexibilidad multi-vertical y consultas razonables. Ver [04](04-domain-overview.md) para el agregado `Listing` y [ADR-003](decisions/ADR-003-multitenancy-strategy.md) para el aislamiento.

---

## 6. Estrategia de migraciones

### 6.1 Reglas

| Regla | Detalle |
|-------|---------|
| Fuente de verdad | Historial de migraciones versionado en el repositorio |
| Desarrollo | `prisma migrate dev` genera y aplica en local; revisión del SQL generado antes de commitear |
| Producción | `prisma migrate deploy` en un paso explícito del despliegue, nunca automático desde la app |
| Prohibido | `prisma db push` como sustituto de migraciones en cualquier entorno compartido |
| Revisión | Toda migración la revisa una segunda persona; las destructivas requieren plan y respaldo |
| Edición | Una migración aplicada en producción **no se edita**; se corrige con una nueva |
| Shadow DB | Base de datos de sombra para detectar divergencias (**PROPUESTA** con el proveedor elegido) |
| Orden | Migraciones backward-compatible primero (expand), limpieza después (contract) |

### 6.2 Cambios destructivos

1. Renombrar columna → agregar nueva, copiar, desplegar código que use ambas, eliminar la vieja en una migración posterior.
2. Eliminar tabla/columna → verificar ausencia de referencias, respaldo verificado, ventana de mantenimiento si aplica.
3. Cambiar tipo → nueva columna + backfill por lotes + validación + switch.
4. Nunca `DROP` en el mismo despliegue que introduce el cambio de código que lo requiere.

### 6.3 Entornos

| Entorno | Base de datos | Migraciones | Datos |
|---------|--------------|-------------|-------|
| Local | Docker Compose | `migrate dev` | Seeds sintéticos |
| Staging | Instancia separada | `migrate deploy` | Subconjunto anonimizado o sintético |
| Producción | Neon Free (proyecto de producción) | `migrate deploy` con aprobación | Reales |

**Nunca** se copian datos de producción a local sin anonimizar.

---

## 7. Conexión y pooling

Decisión vigente: [ADR-006](decisions/ADR-006-production-database-provider.md) — Neon Free, región `aws-sa-east-1`.

- Runtime: cadena **pooled** (host con sufijo `-pooler`, PgBouncer `pool_mode=transaction`). En modo transacción **no** están disponibles `SET`/`RESET` de sesión, `LISTEN/NOTIFY`, `PREPARE`/`DEALLOCATE` a nivel SQL, cursores `WITH HOLD` ni tablas temporales con `PRESERVE` (`https://neon.com/docs/connect/connection-pooling`). El diseño no depende de ninguno de ellos; `search_path` se fija a nivel de rol o se califica el esquema.
- Migraciones e introspección: cadena **directa** (`DATABASE_URL_UNPOOLED`), separada de la de runtime. En Prisma 7 la conexión del CLI se declara en `prisma7.config.ts`.
- Driver: `@prisma/adapter-neon` (guía oficial de Neon para Prisma 7) **o** `@prisma/adapter-pg` con `?pgbouncer=true`; elección **PROPUESTA** hasta el *spike*.
- Tamaño de pool: en Prisma 7 con el adaptador de Neon, `connection_limit`/`pool_timeout` de la URL **no aplican**; se configuran en el adaptador (`max`, `connectionTimeoutMillis`). Valor inicial **PROPUESTA**: `max=5` por instancia de `api` y `max=3` para `worker`.
- Timeouts: `connect_timeout=15` (el arranque en frío de Neon puede tardar varios segundos), `statement_timeout=5000` ms para consultas de aplicación (**PROPUESTA**).
- Arranque en frío: un reintento con espera corta solo ante error de conexión; `/health/ready` informa el estado (ADR-006 §2.4).

---

## 8. Volumen y crecimiento esperado (supuestos)

| Entidad | Año 1 (**SUPUESTO**) | Implicación |
|---------|----------------------|-------------|
| Negocios | 300 | Bajo |
| Usuarios | 1.000 | Bajo |
| Publicaciones activas | 10.000 | Índices y paginación claves |
| Publicaciones históricas | 60.000 | Archivado/expiración |
| Leads/mes | 5.000 | Retención y notificaciones |
| Imágenes | 100.000 (≈ 50 GB) | Storage externo obligatorio |

Estos números son **supuestos de planificación**, no proyecciones comerciales validadas.

---

## 9. Respaldos, restauración y retención

El plan Free de Neon **no incluye backups diarios gestionados**: ofrece *instant restore* sobre una ventana de 6 h (hasta 1 GB de cambios) y **un** snapshot manual (`https://neon.com/docs/introduction/plans`). Por eso el respaldo del MVP combina cuatro mecanismos (detalle en [ADR-006 §2.5](decisions/ADR-006-production-database-provider.md)):

| Mecanismo | Frecuencia | Retención | Cubre |
|-----------|-----------|-----------|-------|
| *Instant restore* (Neon) | Continuo | 6 h | Error humano o migración fallida reciente |
| Snapshot manual (Neon) | Antes de cada migración y semanal | 1 (rotar) | Punto de retorno estable |
| `pg_dump` lógico → Cloudflare R2 | Semanal (job del `worker`) | 12 semanas | Desastre total, corrupción antigua |
| Migraciones versionadas (Git) | Cada cambio | Historial completo | Reconstrucción del esquema |

- **RPO**: ≤ 7 días para desastre total; ≤ 6 h para error reciente. **RTO** objetivo: ≤ 4 h (NFR-B-02).
- Restauración probada antes del lanzamiento y luego trimestralmente; se registra fecha, duración y resultado.
- Los respaldos **no** incluyen objetos de storage: versionado del bucket R2 o copia periódica — **PENDIENTE** de implementación.
- Retención de datos según [07 §10](07-security-and-multitenancy.md).
- Borrado de negocio: anonimización de PII conservando agregados estadísticos y obligaciones contables.

---

## 10. Calidad de datos y seeds

- Seeds **idempotentes** y separados por entorno; nunca se ejecutan en producción.
- Datos sintéticos realistas para la vertical Prenderías (categorías, atributos, publicaciones) que permitan probar filtros y facetas.
- Script de verificación de integridad (huérfanos, estados inconsistentes, slugs duplicados) para ejecutar en CI y en producción bajo demanda.
- Prohibido usar datos personales reales en pruebas.

---

## 11. Decisiones que afectan al modelo

### 11.1 Resueltas (C-10, 2026-11-12)

| # | Decisión | Consecuencia en el modelo |
|---|----------|---------------------------|
| Q-05 | Neon Free (`aws-sa-east-1`) — [ADR-006](decisions/ADR-006-production-database-provider.md) | Solo extensiones estándar: `pg_trgm` y `uuidv7()` del core |
| Q-06 | Sin pasarela: cobro manual y activación por admin | **No** hay `payment_provider_account`, `payment_webhook_event`, `invoice` ni `payment_attempt`; `subscription` añade `activated_by_admin_id` y `activation_note` |
| Q-07 | Sin moderación previa | `business.status` ∈ {`APPROVED`, `SUSPENDED`}; `listing.status` ∈ {`DRAFT`, `PUBLISHED`, `PAUSED`, `SOLD`, `ARCHIVED`}; sin campos de revisión previa |
| Q-02 / Q-03 | Free 10 / Base 30 / Pro 50 publicaciones activas | `plan` + `plan_entitlement(key, value)` con límites configurables |
| Q-15 | COP fijo | `price_currency` con `DEFAULT 'COP'` y `CHECK`; sin tabla de monedas |
| Q-16 | `city` obligatorio + `address_line` opcional; ubicación heredada del negocio | Enum de 10 municipios, `idx_business_city`; sin columnas de latitud/longitud ni PostGIS |

### 11.2 Abiertas (ninguna bloquea el Prompt 02)

| # | Pregunta | Impacto |
|---|----------|---------|
| Q-08 | ¿Lead a negocio sin suscripción vigente? | Reglas de creación y retención |
| Q-14 | ¿Historial de precios? | Tabla adicional o solo auditoría |
| D-01 | ¿UUID v7 en aplicación o con `uuidv7()` de PG 18? | `DEFAULT` de la columna y generación en el dominio |

Ninguna de estas bloquea el Prompt 02: se resuelven como supuestos explícitos en el diccionario de datos.
