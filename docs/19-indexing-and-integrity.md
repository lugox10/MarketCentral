# 19. Índices, claves e integridad

**Fecha:** 2026-11-12 · **Estado:** PROPUESTA · **Alcance:** diseño de restricciones e índices del MVP (sin DDL ejecutable ni migraciones).

Este documento es el contrato de integridad del modelo descrito en [15](15-entity-relationship-model.md) y [16](16-data-dictionary.md). Se apoya en PostgreSQL 18 y en las capacidades verificadas de Neon ([ADR-006](decisions/ADR-006-production-database-provider.md)): `uuidv7()`, `pg_trgm`, `jsonb_path_ops`, índices parciales y `NULLS NOT DISTINCT`.

---

## 1. Claves primarias

| Tabla | PK | Notas |
|-------|----|-------|
| Todas | `id uuid` | UUID v7. **D-01 APROBADA (C-11.1):** `DEFAULT uuidv7()` en la columna (función nativa de PG 18); alternativa `@default(uuid(7))` si el tooling lo exige |
| `plan_entitlement` | `id` | Se conserva `id` aunque el par `(plan_id, key)` sea único, para permitir referencias futuras |
| `listing_image` | `id` | `(listing_id, position)` es único, no PK |
| `audit_entry`, `outbox_event` | `id` | Sin actualización; `event_id` es único adicional |

**Por qué UUID v7 y no secuencial:** no expone volumen de negocio en URLs públicas (`/p/{slug}` usa slug, pero los ids circulan en la API) y mantiene localidad de índice por tiempo. El costo es 16 bytes frente a 8; irrelevante a esta escala.

---

## 2. Claves únicas

| Tabla | Restricción | Tipo | Motivo |
|-------|-------------|------|--------|
| `app_user` | `(lower(email))` | Único funcional | Evita duplicados por mayúsculas |
| `business` | `(slug)` | Único | URL pública estable |
| `business_membership` | `(business_id, user_id)` | Único | Un rol por usuario y negocio |
| `business_vertical` | `(business_id, vertical_id)` | Único | Habilitación única |
| `business_vertical` | `(business_id, vertical_id)` | **Auxiliar** para FK compuesta de `listing` | — |
| `vertical` | `(slug)` | Único | `/v/{slug}` |
| `category` | `(vertical_id, parent_id, slug)` con `NULLS NOT DISTINCT` | Único | Permite el mismo slug bajo padres distintos (PG 15+) |
| `category` | `(id, vertical_id)` | **Auxiliar** para FKs compuestas | — |
| `attribute_definition` | `(vertical_id, category_id, key)` con `NULLS NOT DISTINCT` | Único | Sin duplicados de clave en el mismo ámbito |
| `attribute_option` | `(attribute_definition_id, key)` | Único | — |
| `listing` | `(id, business_id)` | **Auxiliar** para FK de `lead`/`report` | — |
| `listing` | `(business_id, slug)` | Único parcial `WHERE deleted_at IS NULL` | URL `/p/{slug}` por negocio |
| `listing_image` | `(listing_id, position)` y `(listing_id, media_asset_id)` | Único | Sin posiciones ni imágenes duplicadas |
| `media_asset` | `(storage_key)` | Único | Un objeto por clave |
| `plan` | `(code, version)` | Único | Historial de versiones |
| `plan_entitlement` | `(plan_id, key)` | Único | Un valor por límite |
| `session` | `(token_hash)` | Único | Búsqueda por hash |
| `password_reset_token` / `email_verification_token` | `(token_hash)` | Único | — |

### 2.1 Índices únicos parciales (reglas de negocio)

| Regla | Definición conceptual | Por qué parcial |
|-------|----------------------|-----------------|
| Una suscripción viva por negocio | `UNIQUE (business_id) WHERE status IN ('TRIALING','ACTIVE')` | Las filas `EXPIRED`/`CANCELLED` son historial y deben poder repetirse |
| Un `OWNER` activo por negocio | **No hay índice ni trigger**: se valida en el caso de uso `CreateMembership` dentro de la transacción (C-11.6) | El MVP no lo necesita; si en fase 2 se permiten varios `OWNER`, se evalúa trigger de exclusión |
| Un caso abierto por objeto | `UNIQUE (target_business_id, target_listing_id) WHERE decision='PENDING'` | Evita duplicar casos por denuncias repetidas |
| Slug de publicación único entre no borradas | `UNIQUE (business_id, slug) WHERE deleted_at IS NULL` | Permite reutilizar el slug tras un borrado lógico |

---

## 3. Claves foráneas y `ON DELETE`

| FK | Destino | ON DELETE | Razón |
|----|---------|-----------|-------|
| `session.user_id` | `app_user` | CASCADE | Sesión sin usuario no existe |
| `password_reset_token.user_id` / `email_verification_token.user_id` | `app_user` | CASCADE | Ídem |
| `business_membership.business_id` | `business` | CASCADE | Membresía sin negocio no existe |
| `business_membership.user_id` | `app_user` | **RESTRICT** | No se borra un usuario con membresías |
| `business_vertical.business_id` | `business` | CASCADE | Habilitación dependiente |
| `business_vertical.vertical_id` | `vertical` | **RESTRICT** | No se borra una vertical en uso |
| `business.logo_asset_id` | `media_asset` | SET NULL | El logo puede eliminarse sin romper el negocio |
| `category.vertical_id` | `vertical` | RESTRICT | La taxonomía no se borra en cascada |
| `category.(parent_id, vertical_id)` | `category(id, vertical_id)` | RESTRICT | Subcategoría con hijos no se borra |
| `attribute_definition.vertical_id` | `vertical` | RESTRICT | — |
| `attribute_definition.(category_id, vertical_id)` | `category(id, vertical_id)` | RESTRICT | — |
| `attribute_option.attribute_definition_id` | `attribute_definition` | CASCADE | Opciones dependientes |
| `listing.business_id` | `business` | **RESTRICT** | Un negocio con publicaciones no se borra físicamente |
| `listing.(business_id, vertical_id)` | `business_vertical(business_id, vertical_id)` | RESTRICT | Garantiza vertical habilitada |
| `listing.(category_id, vertical_id)` | `category(id, vertical_id)` | RESTRICT | Garantiza categoría de la vertical |
| `media_asset.business_id` | `business` | RESTRICT | — |
| `listing_image.listing_id` | `listing` | CASCADE | Imágenes dependientes |
| `listing_image.media_asset_id` | `media_asset` | RESTRICT | El activo se conserva hasta purgar |
| `lead.business_id` | `business` | RESTRICT | — |
| `lead.(listing_id, business_id)` | `listing(id, business_id)` | RESTRICT, **MATCH SIMPLE** | Si `listing_id` es NULL, la FK no se evalúa (lead desde el perfil) |
| `subscription.business_id` | `business` | RESTRICT | — |
| `subscription.plan_id` | `plan` | RESTRICT | Un plan con suscripciones no se borra |
| `subscription.activated_by_admin_id` | `app_user` | SET NULL | El hecho histórico sobrevive si el admin se desactiva |
| `report.business_id` | `business` | RESTRICT | — |
| `report.(listing_id, business_id)` | `listing(id, business_id)` | RESTRICT | — |
| `report.reporter_user_id` | `app_user` | SET NULL | Denunciante anónimo o eliminado |
| `report.moderation_case_id` | `moderation_case` | SET NULL | La denuncia sobrevive al caso |
| `moderation_case.business_id` | `business` | RESTRICT | — |
| `moderation_case.target_business_id` | `business` | RESTRICT | — |
| `moderation_case.target_listing_id` | `listing` | RESTRICT | — |
| `audit_entry.business_id` | `business` | SET NULL | El hecho de auditoría no se pierde |
| `outbox_event.business_id` | `business` | SET NULL | — |

**Regla general:** `RESTRICT` por defecto; `CASCADE` solo cuando el hijo no tiene significado sin el padre (sesiones, tokens, opciones, imágenes); `SET NULL` cuando el hecho histórico debe sobrevivir (auditoría, admin desactivado, logo).

---

## 4. Restricciones `CHECK`

| Tabla | CHECK | Propósito |
|-------|-------|-----------|
| `listing` | `price_amount > 0 AND price_amount <= 999999999` | Precio válido |
| `listing` | `price_currency = 'COP'` | Q-15 |
| `listing` | `status <> 'PUBLISHED' OR published_at IS NOT NULL` | Coherencia de estado |
| `listing` | `status <> 'SOLD' OR sold_at IS NOT NULL` | Ídem |
| `listing` | `status <> 'ARCHIVED' OR archived_reason IS NOT NULL` | Ídem |
| `listing` | `status <> 'DRAFT' OR published_at IS NULL` | No se publica sin pasar por `PUBLISHED` |
| `listing` | `jsonb_typeof(attributes) = 'object'` | Evita arrays o escalares |
| `listing_image` | `position BETWEEN 0 AND 4` | Máximo 5 imágenes (C-10) |
| `media_asset` | `size_bytes > 0 AND size_bytes <= 5242880` | 5 MB |
| `media_asset` | `mime IN ('image/jpeg','image/png','image/webp')` | Formatos permitidos |
| `media_asset` | `width > 0 AND height > 0 AND width <= 6000 AND height <= 6000` | Límites de dimensión |
| `lead` | `consent_given = true` | Consentimiento obligatorio |
| `lead` | `(email IS NOT NULL OR phone_e164 IS NOT NULL)` | Al menos un canal |
| `lead` | `source = 'WEB_FORM'` | Sin WhatsApp |
| `subscription` | `current_period_end > current_period_start` | Fechas coherentes |
| `subscription` | `status <> 'ACTIVE' OR activated_at IS NOT NULL` | Activación con fecha |
| `subscription` | `activated_by_admin_id IS NULL OR (activation_note IS NOT NULL AND length(activation_note) >= 5)` | R-32: nota obligatoria |
| `subscription` | `status <> 'SUSPENDED' OR suspension_reason IS NOT NULL` | Motivo auditable |
| `subscription` | `status <> 'CANCELLED' OR cancelled_at IS NOT NULL` | — |
| `business` | `status <> 'SUSPENDED' OR suspended_reason IS NOT NULL` | — |
| `business` | `whatsapp_e164 IS NULL OR whatsapp_e164 ~ '^\+57[0-9]{10}$'` | Formato colombiano |
| `moderation_case` | `num_nonnulls(target_business_id, target_listing_id) = 1` | Un solo objeto |
| `moderation_case` | `(target_type='BUSINESS' AND target_business_id IS NOT NULL) OR (target_type='LISTING' AND target_listing_id IS NOT NULL)` | Coherencia tipo/objetivo |
| `moderation_case` | `status='OPEN' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)` | Decisión registrada |
| `attribute_definition` | `key ~ '^[a-z][a-z0-9_]{1,39}$'` | Claves estables |
| `plan_entitlement` | `value ? 'type' AND value ? 'value'` | Forma del entitlement |
| `category` | `depth BETWEEN 0 AND 2` | Profundidad máxima |
| `session` | `expires_at > created_at` | — |

**Lo que un `CHECK` no puede hacer:** validar el contenido semántico de `attributes` contra `attribute_definition` (requiere leer otra tabla), exigir `is_enabled` de `business_vertical`, o contar imágenes por publicación. Estos se cubren con validación transaccional y, opcionalmente, triggers (§6).

---

## 5. Índices

### 5.1 Catálogo público

| Índice | Definición conceptual | Consulta que sirve |
|--------|----------------------|--------------------|
| `idx_listing_public_feed` | `(vertical_id, published_at DESC, id DESC) WHERE status='PUBLISHED' AND deleted_at IS NULL` | Listado por vertical, orden por novedad, paginación keyset |
| `idx_listing_public_price` | `(vertical_id, price_amount, published_at DESC) WHERE status='PUBLISHED' AND deleted_at IS NULL` | Orden/filtro por precio |
| `idx_listing_category` | `(category_id, published_at DESC) WHERE status='PUBLISHED' AND deleted_at IS NULL` | Navegación por categoría |
| `idx_listing_business_public` | `(business_id, published_at DESC) WHERE status='PUBLISHED' AND deleted_at IS NULL` | Perfil público del negocio |
| `idx_listing_attributes_gin` | `GIN (attributes jsonb_path_ops)` | Filtros por atributo (`@>`) |
| `idx_listing_title_trgm` | `GIN (title gin_trgm_ops)` | Búsqueda tolerante a errores de tipeo |
| `idx_listing_search_tsv` | `GIN (to_tsvector('spanish', title || ' ' || coalesce(description,'')))` | Búsqueda de texto completo (índice de expresión; se evalúa columna generada en el Prompt 03) |
| `idx_business_city` | `(city) WHERE status='APPROVED' AND deleted_at IS NULL` | Filtro por municipio (Q-16) |
| `idx_business_slug` | `(slug)` | Detalle de negocio |
| `idx_listing_slug` | `(business_id, slug) WHERE deleted_at IS NULL` | Detalle de publicación |

**Nota sobre `search_tsv`:** un índice GIN sobre `to_tsvector(...)` exige que la expresión sea inmutable; `to_tsvector('spanish', …)` lo es porque la configuración se pasa como constante. Si en el Prompt 03 se adopta una columna generada `search_vector`, el índice pasa a `GIN (search_vector)` y se elimina la expresión. Ambas variantes son válidas; se decide al implementar.

### 5.2 Panel privado y operación

| Índice | Definición conceptual | Consulta |
|--------|----------------------|----------|
| `idx_listing_business_status` | `(business_id, status, updated_at DESC)` | Mis publicaciones por estado |
| `idx_lead_business_status` | `(business_id, status, created_at DESC)` | Bandeja de leads |
| `idx_lead_listing` | `(listing_id)` | Leads por publicación |
| `idx_subscription_business` | `(business_id, status)` | Resolución de suscripción vigente |
| `idx_subscription_expiring` | `(current_period_end) WHERE status IN ('TRIALING','ACTIVE')` | Job de expiración |
| `idx_media_business` | `(business_id, status)` | Galería y limpieza |
| `idx_listing_image_listing` | `(listing_id, position)` | Orden de imágenes |
| `idx_report_business_status` | `(business_id, status, created_at DESC)` | Bandeja de denuncias |
| `idx_report_case` | `(moderation_case_id)` | Caso → denuncias |
| `idx_business_vertical_vertical` | `(vertical_id) WHERE is_enabled` | Negocios por vertical (admin) |
| `idx_attribute_definition_lookup` | `(vertical_id, category_id)` | Resolución de atributos |
| `idx_session_user` | `(user_id, expires_at DESC)` | Sesiones activas de un usuario |
| `idx_audit_business_time` | `(business_id, occurred_at DESC)` | Auditoría por tenant |
| `idx_audit_actor_time` | `(actor_id, occurred_at DESC)` | Auditoría por actor |
| `idx_outbox_pending` | `(status, available_at) WHERE status='PENDING'` | Dispatcher del outbox |
| `idx_outbox_aggregate` | `(aggregate_type, aggregate_id, created_at DESC)` | Trazabilidad de eventos |

### 5.3 Qué no se indexa (y por qué)

| Candidato | Decisión | Motivo |
|-----------|----------|--------|
| `listing.description` con `tsvector` | No en MVP | El título y una búsqueda combinada bastan; cada índice GIN cuesta escritura |
| `lead.message` | No | Volumen bajo; búsqueda libre no es requisito |
| `audit_entry.before/after` | No | Solo se consulta por entidad/actor/tiempo |
| `attributes` con GIN por cada clave | No | Un GIN general + índices de expresión solo para atributos `filterable` con uso demostrado |
| `business.name` con trigram | No todavía | El buscador del MVP busca publicaciones; el perfil se encuentra por slug |

---

## 6. Integridad que requiere trigger (PROPUESTA)

| Trigger | Tabla | Cuándo | Efecto | Alternativa si no se aprueba |
|---------|-------|--------|--------|------------------------------|
| `trg_listing_vertical_enabled` | `listing` BEFORE INSERT/UPDATE | `is_enabled = false` en `business_vertical` | Excepción `VERTICAL_NOT_ENABLED` | Validación en el caso de uso con la misma transacción |
| `trg_listing_max_images` | `listing_image` BEFORE INSERT | Ya hay 5 filas para el `listing_id` | Excepción `MEDIA_LIMIT_REACHED` | Validación al agregar + `CHECK` de posición |
| `trg_category_depth` | `category` BEFORE INSERT/UPDATE | `depth` incoherente con `parent_id` | Excepción `INVALID_DEPTH` | Cálculo en el servicio de taxonomía |

**Descartado explícitamente (C-11.6):** no se crea `trg_business_last_owner`. El MVP tiene un único miembro y el caso de uso `CreateMembership` verifica la ausencia de otro `OWNER` activo dentro de la misma transacción. *Si en fase 2 se permiten varios `OWNER`, se evalúa un trigger de exclusión.* La regla `LAST_OWNER` al eliminar membresías se mantiene como validación de aplicación ([07 §5](07-security-and-multitenancy.md)).

**Recomendación:** aprobar solo `trg_listing_max_images` en el MVP (regla fácil de violar con daño visible). Las demás se validan en aplicación porque el caso de uso ya las conoce y el trigger añade superficie de mantenimiento.

---

## 7. Concurrencia y bloqueos

| Operación | Estrategia | Detalle |
|-----------|-----------|---------|
| Publicar (límite del plan) | Bloqueo del negocio + conteo en la misma transacción | `SELECT ... FROM business WHERE id = :id FOR UPDATE`; luego contar publicaciones activas. Evita que dos publicaciones simultáneas superen el límite |
| Activar suscripción (R-32) | `FOR UPDATE` sobre `subscription` + índice único parcial | La segunda transacción espera, ve `ACTIVE` y responde idempotente |
| Editar publicación | Control optimista con `version` | `UPDATE ... WHERE id=:id AND version=:v`; si 0 filas → `409 CONCURRENT_MODIFICATION` |
| Crear lead | Sin bloqueo | Inserción pura; el rate limit es previo y en memoria/Redis si se aprueba |
| Consumir outbox | `FOR UPDATE SKIP LOCKED` | Varias instancias del worker no repiten el mismo evento |
| Expirar suscripciones | Lotes de 100 con `FOR UPDATE SKIP LOCKED` | Idempotente por estado |

**Aislamiento:** `READ COMMITTED` por defecto. No se usa `SERIALIZABLE` en el MVP: los puntos de contención están resueltos con bloqueos explícitos y restricciones únicas.

---

## 8. Planes de consulta esperados

| Consulta | Plan esperado | Señal de alarma |
|----------|---------------|-----------------|
| Catálogo por vertical, 24 filas | `Index Scan` sobre `idx_listing_public_feed` + `Nested Loop` a `business` | `Seq Scan` en `listing` con > 50 k filas |
| Filtro por atributo | `Bitmap Index Scan` sobre `idx_listing_attributes_gin` | Filtro sin índice → `Seq Scan` |
| Búsqueda por texto | `Bitmap Index Scan` sobre `idx_listing_search_tsv` | `ts_rank` sobre conjunto grande sin límite |
| Leads por negocio | `Index Scan` sobre `idx_lead_business_status` | Orden en memoria (`Sort` con `work_mem` excedido) |
| Suscripción vigente | `Index Scan` sobre `idx_subscription_business` | — |

**Umbral de revisión:** si el p95 del catálogo supera 300 ms ([08 §4](08-non-functional-requirements.md)) con los índices anteriores, se evalúa (en este orden): columna generada de búsqueda, índices de expresión por atributo filtrable, y solo después caché de consulta con TTL ≤ 60 s.

---

## 9. Mantenimiento

| Tarea | Frecuencia | Herramienta |
|-------|-----------|-------------|
| `ANALYZE` de tablas grandes | Semanal | `autovacuum` + revisión |
| Reindexado de GIN | Cuando el *bloat* lo justifique | `REINDEX CONCURRENTLY` |
| Purga de sesiones expiradas | Diaria | Job del worker |
| Purga de tokens usados/expirados | Diaria | Job del worker |
| Purga de `outbox_event` publicados | 90 días | Job del worker ([09 §4](09-integrations-and-n8n-readiness.md)) |
| Verificación de integridad | Trimestral | Consultas de huérfanos y restauración de respaldo ([20 §7](20-data-retention-and-privacy.md)) |

---

## 10. Pruebas de integridad

| ID | Escenario | Resultado |
|----|-----------|-----------|
| K-01 | Insertar `listing` con `category_id` de otra vertical | Violación de FK |
| K-02 | Insertar `listing` con vertical no habilitada | Violación de FK |
| K-03 | Insertar `lead` con `business_id` distinto al de la publicación | Violación de FK |
| K-04 | Insertar segunda suscripción `ACTIVE` para el mismo negocio | Violación de índice único parcial |
| K-05 | Activar suscripción sin `activation_note` | Violación de `CHECK` |
| K-06 | Insertar sexta imagen | `CHECK` de posición o trigger |
| K-07 | `PUBLISHED` sin `published_at` | Violación de `CHECK` |
| K-08 | `price_currency='USD'` | Violación de `CHECK` |
| K-09 | Lead sin consentimiento | Violación de `CHECK` |
| K-10 | Caso de moderación con dos objetivos | Violación de `CHECK` |
| K-11 | Revocar el último `OWNER` | `LAST_OWNER` (trigger o caso de uso) |
| K-12 | Dos activaciones concurrentes | Una gana; la otra responde idempotente |
