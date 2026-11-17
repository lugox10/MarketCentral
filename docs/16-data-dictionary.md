# 16. Diccionario de datos

**Fecha:** 2026-11-12 · **Estado:** PROPUESTA · **Alcance:** modelo lógico del MVP (sin DDL, sin Prisma).

Convenciones: `uuid` = UUID v7; `timestamptz` = instante UTC; `jsonb` = JSON validado en aplicación; `text` sin límite salvo indicación; "S" en la columna **Sens.** indica dato personal o sensible a efectos de [20](20-data-retention-and-privacy.md).

El modelo ER y la justificación de relaciones están en [15](15-entity-relationship-model.md); las restricciones ejecutables y los índices, en [19](19-indexing-and-integrity.md); los estados, en [18](18-state-transition-matrix.md).

---

## 1. Identidad y acceso

### 1.1 `app_user`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | Identificador |
| `email` | citext / text | ✗ | — | UNIQUE; normalizado a minúsculas; formato válido | **S** | Identidad de acceso y contacto |
| `password_hash` | text | ✓ | — | Argon2id PHC string; nulo solo si el usuario se creó por invitación y aún no fijó contraseña | **S** | Nunca se registra ni se devuelve |
| `display_name` | text | ✗ | — | 1–80 caracteres | **S** | Nombre visible |
| `email_verified_at` | timestamptz | ✓ | — | — | — | Verificación de correo |
| `status` | enum `user_status` | ✗ | `ACTIVE` | `ACTIVE`, `DISABLED` | — | Deshabilitado no puede iniciar sesión |
| `last_login_at` | timestamptz | ✓ | — | — | **S** | Último acceso correcto |
| `failed_login_count` | int | ✗ | `0` | ≥ 0 | — | Base para bloqueo temporal |
| `locked_until` | timestamptz | ✓ | — | > `now()` si existe | — | Bloqueo por fuerza bruta |
| `created_at` | timestamptz | ✗ | `now()` | — | — | — |
| `updated_at` | timestamptz | ✗ | `now()` | — | — | — |
| `deleted_at` | timestamptz | ✓ | — | — | — | Baja lógica; el email queda reservado |

**Minimización:** no se guarda cédula, dirección, fecha de nacimiento ni teléfono del comprador en esta tabla. El teléfono del negocio vive en `business.whatsapp_e164`.

### 1.2 `session`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `user_id` | uuid | ✗ | — | FK → `app_user(id)` ON DELETE CASCADE | — | Dueño de la sesión |
| `token_hash` | text | ✗ | — | UNIQUE; SHA-256 del token opaco | **S** | El token en claro nunca se almacena |
| `expires_at` | timestamptz | ✗ | — | > `created_at` | — | Expiración absoluta |
| `revoked_at` | timestamptz | ✓ | — | — | — | Cierre de sesión o revocación |
| `ip_hash` | text | ✓ | — | HMAC con pepper del servidor | **S** | Se guarda hash, no IP en claro |
| `user_agent_summary` | text | ✓ | — | ≤ 120 caracteres | **S** | Navegador y SO resumidos |
| `created_at` | timestamptz | ✗ | `now()` | — | — | — |

### 1.3 `password_reset_token` y `email_verification_token`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `user_id` | uuid | ✗ | — | FK → `app_user(id)` ON DELETE CASCADE | — | — |
| `token_hash` | text | ✗ | — | UNIQUE | **S** | Un solo uso |
| `expires_at` | timestamptz | ✗ | — | 30 min (reset) / 24 h (verificación) | — | — |
| `used_at` | timestamptz | ✓ | — | — | — | Marca de consumo |
| `created_at` | timestamptz | ✗ | `now()` | — | — | — |

---

## 2. Negocio y membresías

### 2.1 `business`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `slug` | text | ✗ | — | UNIQUE; `^[a-z0-9-]{3,60}$` | — | URL pública `/n/{slug}` |
| `name` | text | ✗ | — | 2–80 caracteres | — | Nombre comercial |
| `description` | text | ✓ | — | ≤ 1.000 caracteres | — | Perfil público |
| `status` | enum `business_status` | ✗ | `APPROVED` | `APPROVED`, `SUSPENDED`, `CLOSED` | — | Sin `PENDING_REVIEW` (Q-07) |
| `city` | enum `amva_city` | ✗ | — | 10 municipios del AMVA | — | Obligatorio (Q-16) |
| `address_line` | text | ✓ | — | ≤ 160 caracteres | **S** | Texto libre; no se muestra completo en el catálogo |
| `whatsapp_e164` | text | ✓ | — | `^\+57\d{10}$` para Colombia | **S** | Número comercial; el enlace se arma en el servidor |
| `contact_email` | text | ✓ | — | Formato válido | **S** | Contacto público del negocio |
| `logo_asset_id` | uuid | ✓ | — | FK → `media_asset(id)` ON DELETE SET NULL; el activo debe ser del mismo negocio | — | Logo |
| `accepted_terms_at` | timestamptz | ✗ | — | NOT NULL | — | Aceptación de T&C (L-01) |
| `privacy_policy_version` | text | ✗ | — | Formato `YYYY-MM-DD` | — | Versión aceptada |
| `suspended_reason` | text | ✓ | — | Obligatorio si `status = SUSPENDED` | — | Motivo auditable |
| `created_at` / `updated_at` | timestamptz | ✗ | `now()` | — | — | — |
| `deleted_at` | timestamptz | ✓ | — | — | — | Baja lógica |

### 2.2 `business_membership`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `business_id` | uuid | ✗ | — | FK → `business(id)` ON DELETE CASCADE | — | Tenant |
| `user_id` | uuid | ✗ | — | FK → `app_user(id)` ON DELETE RESTRICT | — | Miembro |
| `role` | enum `membership_role` | ✗ | `OWNER` | `OWNER`, `ADMIN`, `EDITOR`, `VIEWER` | — | En MVP solo `OWNER` |
| `status` | enum `membership_status` | ✗ | `ACTIVE` | `ACTIVE`, `REVOKED` | — | — |
| `invited_by` | uuid | ✓ | — | FK → `app_user(id)` | — | Fase 2 |
| `created_at` / `updated_at` | timestamptz | ✗ | `now()` | — | — | — |

**Único:** `(business_id, user_id)`. **Parcial:** `(business_id) WHERE role='OWNER' AND status='ACTIVE'` (garantiza al menos uno y, en MVP, exactamente uno).

### 2.3 `business_vertical`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `business_id` | uuid | ✗ | — | FK → `business(id)` ON DELETE CASCADE | — | — |
| `vertical_id` | uuid | ✗ | — | FK → `vertical(id)` ON DELETE RESTRICT | — | — |
| `is_enabled` | boolean | ✗ | `true` | — | — | Habilitación por admin |
| `enabled_at` | timestamptz | ✗ | `now()` | — | — | — |
| `enabled_by` | uuid | ✓ | — | FK → `app_user(id)` | — | Admin que habilitó |

**Único:** `(business_id, vertical_id)`. **Único auxiliar:** `(business_id, vertical_id)` sirve además como destino de la FK compuesta de `listing`.

---

## 3. Taxonomía

### 3.1 `vertical`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `slug` | text | ✗ | — | UNIQUE; `^[a-z0-9-]{2,40}$` | — | `/v/{slug}` |
| `name` | text | ✗ | — | 2–60 | — | "Prenderías" |
| `status` | enum `vertical_status` | ✗ | `ACTIVE` | `ACTIVE`, `INACTIVE` | — | Desactivar no borra datos |
| `description` | text | ✓ | — | ≤ 500 | — | Texto de portada |
| `sort_order` | int | ✗ | `0` | ≥ 0 | — | Orden en la portada |
| `created_at` / `updated_at` | timestamptz | ✗ | `now()` | — | — | — |

### 3.2 `category`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK; UNIQUE auxiliar `(id, vertical_id)` | — | — |
| `vertical_id` | uuid | ✗ | — | FK → `vertical(id)` ON DELETE RESTRICT | — | — |
| `parent_id` | uuid | ✓ | — | FK compuesta `(parent_id, vertical_id)` → `category(id, vertical_id)` ON DELETE RESTRICT | — | Subcategoría |
| `slug` | text | ✗ | — | UNIQUE `(vertical_id, parent_id, slug)` | — | — |
| `name` | text | ✗ | — | 2–60 | — | — |
| `depth` | smallint | ✗ | `0` | 0–2 | — | Máximo 3 niveles |
| `status` | enum `category_status` | ✗ | `ACTIVE` | `ACTIVE`, `INACTIVE` | — | — |
| `sort_order` | int | ✗ | `0` | ≥ 0 | — | — |
| `created_at` / `updated_at` | timestamptz | ✗ | `now()` | — | — | — |

### 3.3 `attribute_definition`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `vertical_id` | uuid | ✗ | — | FK → `vertical(id)` ON DELETE RESTRICT | — | Ámbito mínimo |
| `category_id` | uuid | ✓ | — | FK compuesta `(category_id, vertical_id)` → `category(id, vertical_id)` | — | `NULL` = aplica a toda la vertical |
| `key` | text | ✗ | — | `(vertical_id, category_id, key)` único con `NULLS NOT DISTINCT`; `^[a-z][a-z0-9_]{1,39}$` | — | Clave en JSONB |
| `label` | text | ✗ | — | 2–60 | — | Etiqueta visible |
| `data_type` | enum `attribute_type` | ✗ | — | `TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, `ENUM` | — | Tipo lógico |
| `required` | boolean | ✗ | `false` | — | — | Obligatorio al publicar |
| `filterable` | boolean | ✗ | `false` | — | — | Habilita filtro/índice |
| `searchable` | boolean | ✗ | `false` | — | — | Entra al texto de búsqueda |
| `validation` | jsonb | ✓ | `{}` | Esquema acotado: `min`, `max`, `maxLength`, `regex`, `minDate`, `maxDate` | — | No ejecuta SQL ni código |
| `sort_order` | int | ✗ | `0` | ≥ 0 | — | Orden del formulario |
| `status` | enum `definition_status` | ✗ | `ACTIVE` | `ACTIVE`, `INACTIVE` | — | Desactivar no borra valores existentes |
| `created_at` / `updated_at` | timestamptz | ✗ | `now()` | — | — | — |

### 3.4 `attribute_option`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `attribute_definition_id` | uuid | ✗ | — | FK → `attribute_definition(id)` ON DELETE CASCADE | — | Solo para `ENUM` |
| `key` | text | ✗ | — | UNIQUE `(attribute_definition_id, key)`; minúsculas | — | Valor almacenado |
| `label` | text | ✗ | — | 1–60 | — | Texto visible |
| `sort_order` | int | ✗ | `0` | ≥ 0 | — | — |
| `is_active` | boolean | ✗ | `true` | — | — | Opción retirada sigue válida en datos históricos |

---

## 4. Publicaciones

### 4.1 `listing`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK; UNIQUE auxiliar `(id, business_id)` | — | — |
| `business_id` | uuid | ✗ | — | FK → `business(id)` ON DELETE RESTRICT | — | Tenant |
| `vertical_id` | uuid | ✗ | — | FK compuesta `(business_id, vertical_id)` → `business_vertical(business_id, vertical_id)` | — | Vertical habilitada |
| `category_id` | uuid | ✗ | — | FK compuesta `(category_id, vertical_id)` → `category(id, vertical_id)` | — | Categoría de la misma vertical |
| `title` | text | ✗ | — | 3–120 caracteres | — | — |
| `description` | text | ✓ | — | ≤ 5.000 caracteres | — | — |
| `price_amount` | integer | ✗ | — | `> 0`; `≤ 999999999` | — | Pesos COP enteros (C-03) |
| `price_currency` | char(3) | ✗ | `'COP'` | `CHECK (price_currency = 'COP')` | — | Q-15 |
| `condition_code` | enum `listing_condition` | ✗ | — | `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`, `POOR` (enum fijo, C-11.3 / D-13) | — | Estado de conservación |
| `status` | enum `listing_status` | ✗ | `DRAFT` | `DRAFT`, `PUBLISHED`, `PAUSED`, `SOLD`, `ARCHIVED` | — | Sin `PENDING_REVIEW`/`REJECTED` |
| `attributes` | jsonb | ✗ | `'{}'` | Validado por aplicación; GIN `jsonb_path_ops` | — | Valores de atributos |
| `attributes_schema_version` | int | ✗ | `1` | ≥ 1 | — | Permite migrar valores si cambia el tipo |
| `published_at` | timestamptz | ✓ | — | NOT NULL si `status='PUBLISHED'` | — | — |
| `sold_at` | timestamptz | ✓ | — | NOT NULL si `status='SOLD'` | — | — |
| `archived_reason` | enum `archive_reason` | ✓ | — | `MANUAL`, `EXPIRED`, `MODERATION`, `BUSINESS_CLOSED` | — | Motivo del archivado |
| `views_count` | int | ✗ | `0` | ≥ 0 | — | Contador aproximado (no crítico) |
| `version` | int | ✗ | `0` | ≥ 0 | — | Control optimista |
| `created_at` / `updated_at` | timestamptz | ✗ | `now()` | — | — | — |
| `deleted_at` | timestamptz | ✓ | — | — | — | — |

**Checks de coherencia de estado** (ver [19 §3](19-indexing-and-integrity.md)): `PUBLISHED ⇒ published_at NOT NULL`; `SOLD ⇒ sold_at NOT NULL`; `ARCHIVED ⇒ archived_reason NOT NULL`; `DRAFT ⇒ published_at IS NULL`.

### 4.2 `media_asset`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `business_id` | uuid | ✗ | — | FK → `business(id)` ON DELETE RESTRICT | — | Dueño del objeto |
| `storage_key` | text | ✗ | — | UNIQUE; `^[a-z0-9/_-]+\.(jpg|jpeg|png|webp)$` | — | Ruta en R2 |
| `mime` | text | ✗ | — | `image/jpeg`, `image/png`, `image/webp` | — | MIME **detectado** (magic bytes), no el declarado |
| `size_bytes` | integer | ✗ | — | `> 0 AND ≤ 5_242_880` | — | Máximo 5 MB |
| `width` / `height` | integer | ✓ | — | `> 0`; `≤ 6000`; relación 1:3–3:1 | — | Se llenan tras procesar |
| `checksum_sha256` | char(64) | ✓ | — | — | — | Detección de duplicados |
| `status` | enum `asset_status` | ✗ | `PENDING` | `PENDING`, `READY`, `FAILED` | — | `FAILED` no se asigna a publicaciones |
| `created_at` | timestamptz | ✗ | `now()` | — | — | — |
| `deleted_at` | timestamptz | ✓ | — | — | — | Borrado lógico antes de purgar R2 |

### 4.3 `listing_image`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `listing_id` | uuid | ✗ | — | FK → `listing(id)` ON DELETE CASCADE | — | — |
| `media_asset_id` | uuid | ✗ | — | FK → `media_asset(id)` ON DELETE RESTRICT | — | Mismo negocio que la publicación (validado en caso de uso) |
| `position` | smallint | ✗ | — | `0–4`; UNIQUE `(listing_id, position)` | — | 0 = portada |
| `alt_text` | text | ✓ | — | ≤ 160 | — | Accesibilidad |
| `created_at` | timestamptz | ✗ | `now()` | — | — | — |

**Único:** `(listing_id, media_asset_id)`. **Regla:** máximo 5 por publicación (CHECK de posición + validación al insertar; ver [19 §6](19-indexing-and-integrity.md)).

---

## 5. Contacto

### 5.1 `lead`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `business_id` | uuid | ✗ | — | FK → `business(id)` ON DELETE RESTRICT | — | Destinatario |
| `listing_id` | uuid | ✓ | — | FK compuesta `(listing_id, business_id)` → `listing(id, business_id)` | — | Publicación de origen (opcional) |
| `name` | text | ✗ | — | 2–80 | **S** | Nombre del comprador |
| `email` | text | ✓ | — | Formato válido; requerido si no hay teléfono | **S** | — |
| `phone_e164` | text | ✓ | — | `^\+57\d{10}$`; requerido si no hay email | **S** | — |
| `message` | text | ✗ | — | 10–2.000 | **S** | Contenido libre; puede contener datos personales |
| `source` | enum `lead_source` | ✗ | `WEB_FORM` | Solo `WEB_FORM` en el MVP | — | Sin WhatsApp: no genera lead |
| `status` | enum `lead_status` | ✗ | `NEW` | `NEW`, `CONTACTED`, `CLOSED_WON`, `CLOSED_LOST`, `SPAM` | — | — |
| `consent_given` | boolean | ✗ | — | `CHECK (consent_given = true)` | — | Consentimiento obligatorio |
| `consent_text` | text | ✗ | — | Versión exacta mostrada | — | Prueba del consentimiento |
| `consent_at` | timestamptz | ✗ | `now()` | — | — | — |
| `ip_hash` | text | ✓ | — | HMAC | **S** | Antiabuso, no geolocalización |
| `user_agent_summary` | text | ✓ | — | ≤ 120 | **S** | Antiabuso |
| `contacted_at` | timestamptz | ✓ | — | — | — | Primera respuesta del negocio |
| `closed_at` | timestamptz | ✓ | — | — | — | Cierre |
| `created_at` | timestamptz | ✗ | `now()` | — | — | — |
| `deleted_at` | timestamptz | ✓ | — | — | — | Baja lógica / anonimización |

**Inmutabilidad:** `name`, `email`, `phone_e164`, `message`, `consent_*` no se actualizan. Solo cambian `status`, `contacted_at`, `closed_at`, `deleted_at`.

---

## 6. Suscripciones

### 6.1 `plan`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `code` | text | ✗ | — | UNIQUE `(code, version)`; `FREE`, `BASE`, `PRO` | — | — |
| `version` | int | ✗ | `1` | ≥ 1 | — | Nueva versión al cambiar límites |
| `name` | text | ✗ | — | 2–40 | — | "Base" |
| `price_amount` | integer | ✗ | — | ≥ 0; `0` para Free | — | COP enteros |
| `price_currency` | char(3) | ✗ | `'COP'` | `CHECK = 'COP'` | — | — |
| `interval_months` | smallint | ✗ | `1` | `1`, `3`, `6`, `12` | — | Periodicidad |
| `trial_days` | smallint | ✗ | `0` | 0–90; Free = 60 | — | Días de prueba |
| `is_active` | boolean | ✗ | `true` | — | — | No contratable si `false` |
| `created_at` / `updated_at` | timestamptz | ✗ | `now()` | — | — | — |

### 6.2 `plan_entitlement`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `plan_id` | uuid | ✗ | — | FK → `plan(id)` ON DELETE CASCADE | — | — |
| `key` | text | ✗ | — | UNIQUE `(plan_id, key)`; catálogo cerrado | — | `max_active_listings`, `max_images_per_listing`, `max_members`, `leads_panel` |
| `value` | jsonb | ✗ | — | `{"type":"integer"|"boolean","value":…}` validado | — | 10 / 30 / 50; 5; 1; true |
| `created_at` / `updated_at` | timestamptz | ✗ | `now()` | — | — | — |

### 6.3 `subscription`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `business_id` | uuid | ✗ | — | FK → `business(id)` ON DELETE RESTRICT | — | Tenant |
| `plan_id` | uuid | ✗ | — | FK → `plan(id)` ON DELETE RESTRICT | — | — |
| `status` | enum `subscription_status` | ✗ | — | `TRIALING`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `CANCELLED`; sin default: lo fija el caso de uso | — | Ver [18 §4](18-state-transition-matrix.md) |
| `current_period_start` | timestamptz | ✗ | `now()` | — | — | — |
| `current_period_end` | timestamptz | ✗ | — | `> current_period_start` | — | — |
| `trial_end` | timestamptz | ✓ | — | `≥ current_period_start` | — | Fin del periodo Free |
| `cancelled_at` | timestamptz | ✓ | — | NOT NULL si `status='CANCELLED'` | — | — |
| `activated_at` | timestamptz | ✓ | — | NOT NULL si `status='ACTIVE'` | — | — |
| `activated_by_admin_id` | uuid | ✓ | — | FK → `app_user(id)`; NOT NULL si la activación es manual | — | R-32 |
| `activation_note` | text | ✓ | — | NOT NULL si `activated_by_admin_id` no es nulo; 5–500 caracteres | — | Nota obligatoria |
| `suspension_reason` | text | ✓ | — | NOT NULL si `status='SUSPENDED'` | — | Auditoría del motivo |
| `created_at` / `updated_at` | timestamptz | ✗ | `now()` | — | — | — |

**Único parcial:** `(business_id) WHERE status IN ('TRIALING','ACTIVE')` — máximo una suscripción viva. **Índice:** `(business_id, status)`.

---

## 7. Moderación reactiva

### 7.1 `report`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `business_id` | uuid | ✗ | — | FK → `business(id)` ON DELETE RESTRICT | — | Negocio denunciado |
| `listing_id` | uuid | ✓ | — | FK compuesta `(listing_id, business_id)` → `listing(id, business_id)` | — | Publicación denunciada |
| `reporter_user_id` | uuid | ✓ | — | FK → `app_user(id)` ON DELETE SET NULL | **S** | Puede ser anónimo |
| `reason` | enum `report_reason` | ✗ | — | `PROHIBITED_ITEM`, `FRAUD`, `COUNTERFEIT`, `OFFENSIVE`, `OTHER` | — | — |
| `details` | text | ✓ | — | ≤ 1.000 | **S** | — |
| `status` | enum `report_status` | ✗ | `OPEN` | `OPEN`, `TRIAGED`, `DISMISSED`, `ACTIONED` | — | — |
| `moderation_case_id` | uuid | ✓ | — | FK → `moderation_case(id)` ON DELETE SET NULL | — | — |
| `created_at` | timestamptz | ✗ | `now()` | — | — | — |

### 7.2 `moderation_case`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `business_id` | uuid | ✗ | — | FK → `business(id)` ON DELETE RESTRICT | — | Tenant del objeto |
| `target_type` | enum `moderation_target` | ✗ | — | `BUSINESS`, `LISTING` | — | — |
| `target_business_id` | uuid | ✓ | — | FK → `business(id)`; CHECK de exclusividad | — | — |
| `target_listing_id` | uuid | ✓ | — | FK → `listing(id)`; CHECK de exclusividad | — | — |
| `decision` | enum `moderation_decision` | ✗ | `PENDING` | `PENDING`, `RESOLVED_UPHELD`, `RESOLVED_DISMISSED` | — | Resultado del caso (C-11.5) |
| `decided_by` | uuid | ✓ | — | FK → `app_user(id)`; NOT NULL si `decision ≠ 'PENDING'` | — | Moderador que resolvió |
| `decided_at` | timestamptz | ✓ | — | NOT NULL si `decision ≠ 'PENDING'` | — | — |
| `resolution_note` | text | ✓ | — | NOT NULL si `decision ≠ 'PENDING'`; 5–500 | — | Motivo de la decisión |
| `created_at` / `updated_at` | timestamptz | ✗ | `now()` | — | — | — |

**Nota (C-11.5):** `decision` sustituye al antiguo par `status`/`decision`. `PENDING` equivale a caso abierto; `RESOLVED_UPHELD` es denuncia con razón (se aplica una acción) y `RESOLVED_DISMISSED` es denuncia desestimada. La acción concreta (`SUSPEND_BUSINESS`, `ARCHIVE_LISTING`, `NO_ACTION`) no se duplica aquí: queda en `audit_entry` y en el estado del objeto afectado, que es la fuente de verdad.

---

## 8. Transversal

### 8.1 `audit_entry`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `actor_type` | enum `actor_type` | ✗ | — | `USER`, `ADMIN`, `SYSTEM` | — | — |
| `actor_id` | uuid | ✓ | — | Sin FK (el actor puede desaparecer) | — | — |
| `action` | text | ✗ | — | `^[a-z][a-z0-9.]{3,60}$` | — | `subscription.activate`, `listing.archive` |
| `entity_type` | text | ✗ | — | Catálogo cerrado | — | — |
| `entity_id` | uuid | ✓ | — | — | — | — |
| `business_id` | uuid | ✓ | — | FK → `business(id)` ON DELETE SET NULL | — | Tenant del hecho |
| `before` / `after` | jsonb | ✓ | — | Solo campos relevantes; **nunca** secretos ni contraseñas | **S** | — |
| `request_id` | text | ✓ | — | ≤ 64 | — | Correlación |
| `ip_hash` | text | ✓ | — | HMAC | **S** | — |
| `occurred_at` | timestamptz | ✗ | `now()` | — | — | Sin `updated_at`: append-only |

### 8.2 `outbox_event`

| Campo | Tipo | Nul. | Def. | Restricciones | Sens. | Descripción |
|-------|------|:----:|------|---------------|:-----:|-------------|
| `id` | uuid | ✗ | — | PK | — | — |
| `event_id` | uuid | ✗ | — | UNIQUE | — | Idempotencia del consumidor |
| `event_type` | text | ✗ | — | Catálogo v1 ([09 §3](09-integrations-and-n8n-readiness.md)) | — | `listing.published` |
| `event_version` | smallint | ✗ | `1` | ≥ 1 | — | — |
| `aggregate_type` | text | ✗ | — | `business`, `listing`, `lead`, `subscription` | — | — |
| `aggregate_id` | uuid | ✗ | — | — | — | — |
| `business_id` | uuid | ✓ | — | FK → `business(id)` ON DELETE SET NULL | — | Tenant para filtrado |
| `payload` | jsonb | ✗ | — | Sin datos personales innecesarios ([20 §6](20-data-retention-and-privacy.md)) | **S** | — |
| `status` | enum `outbox_status` | ✗ | `PENDING` | `PENDING`, `PUBLISHED`, `FAILED` | — | — |
| `attempts` | smallint | ✗ | `0` | 0–10 | — | Backoff |
| `available_at` | timestamptz | ✗ | `now()` | — | — | Reintento programado |
| `published_at` | timestamptz | ✓ | — | — | — | — |
| `last_error` | text | ✓ | — | ≤ 500 | — | — |
| `created_at` | timestamptz | ✗ | `now()` | — | — | — |

**Índice:** `(status, available_at) WHERE status='PENDING'` para el *dispatcher* del worker ([09 §4](09-integrations-and-n8n-readiness.md)).

---

## 9. Catálogo de enums

| Enum | Valores | Notas |
|------|---------|-------|
| `user_status` | `ACTIVE`, `DISABLED` | — |
| `business_status` | `APPROVED`, `SUSPENDED`, `CLOSED` | Sin `PENDING_REVIEW` (Q-07) |
| `membership_role` | `OWNER`, `ADMIN`, `EDITOR`, `VIEWER` | Solo `OWNER` en MVP |
| `membership_status` | `ACTIVE`, `REVOKED` | — |
| `vertical_status` / `category_status` | `ACTIVE`, `INACTIVE` | — |
| `attribute_type` | `TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, `ENUM` | El encargo no incluye `MULTISELECT`: se difiere |
| `definition_status` | `ACTIVE`, `INACTIVE` | — |
| `listing_status` | `DRAFT`, `PUBLISHED`, `PAUSED`, `SOLD`, `ARCHIVED` | Sin `EXPIRED` (C-02) |
| `archive_reason` | `MANUAL`, `EXPIRED`, `MODERATION`, `BUSINESS_CLOSED` | — |
| `asset_status` | `PENDING`, `READY`, `FAILED` | — |
| `lead_status` | `NEW`, `CONTACTED`, `CLOSED_WON`, `CLOSED_LOST`, `SPAM` | — |
| `lead_source` | `WEB_FORM` | WhatsApp no genera lead |
| `condition_code` | `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`, `POOR` | Enum fijo (C-11.3 / D-13). Granularidad extra vía atributo `condition_detail` |
| `subscription_status` | `TRIALING`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `CANCELLED` | Cinco estados (C-11.2) |
| `report_reason` / `report_status` | ver §7 | — |
| `moderation_target` / `moderation_decision` | ver §7 | `moderation_decision` = `PENDING`, `RESOLVED_UPHELD`, `RESOLVED_DISMISSED` |
| `actor_type` / `outbox_status` | ver §8 | — |

---

## 10. Atributos: resolución efectiva y validación

**Resolución.** Para una publicación del par (`vertical_id`, `category_id`):

1. Se toman las definiciones `ACTIVE` de la vertical con `category_id IS NULL`.
2. Se añaden las definiciones `ACTIVE` de esa categoría (pueden sobrescribir `required`, `validation` y `sort_order` de la definición de vertical con la misma `key`).
3. Se descartan claves duplicadas quedándose con la más específica.

**Validación al publicar** (caso de uso, no base de datos):

| Tipo | Regla |
|------|-------|
| `TEXT` | string, `maxLength` (default 200), `regex` si existe |
| `NUMBER` | número finito; `min`/`max`; sin notación científica |
| `BOOLEAN` | `true`/`false` |
| `DATE` | `YYYY-MM-DD`; rango `minDate`/`maxDate`; no futura salvo indicación |
| `ENUM` | `key` de una `attribute_option` activa **o** usada históricamente |

**Claves prohibidas en JSONB:** `__proto__`, `constructor`, `prototype`; profundidad máxima 2; tamaño máximo del objeto 8 KB. Un atributo `required` ausente bloquea la publicación con `MISSING_REQUIRED_ATTRIBUTES`.

---

## 11. Sensibilidad y minimización

| Dato | Tabla | Tratamiento |
|------|-------|-------------|
| Email, nombre, teléfono del comprador | `lead` | Necesario para responder; retención 12 meses; anonimización a solicitud |
| Email y nombre del usuario | `app_user` | Cuenta; retención mientras la cuenta exista |
| Teléfono comercial, dirección | `business` | Datos del negocio, no del comprador; visibilidad controlada |
| IP | `session`, `lead`, `audit_entry` | Solo hash con pepper; nunca IP en claro |
| Contenido del mensaje del lead | `lead.message` | Puede contener datos personales; no se envía a logs ni a `payload` de eventos |
| Contraseña | `app_user.password_hash` | Argon2id; nunca se registra |
| Tokens | `session`, `*_token` | Solo hash |

**No se recolecta:** cédula, fecha de nacimiento, dirección del comprador, datos financieros, geolocalización precisa.

---

## 12. Cierres aplicados en C-11 (2026-11-12)

| Decisión | Efecto en el diccionario |
|----------|--------------------------|
| C-11.1 / D-01 | Todas las PK `uuid` con `DEFAULT uuidv7()` (PostgreSQL 18). Sin generación en aplicación. |
| C-11.2 / C-01 | `subscription.status` con **cinco** valores (`TRIALING`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `CANCELLED`), sin default; `cancelled_at` obligatorio si `CANCELLED`; único parcial `('TRIALING','ACTIVE')`. |
| C-11.3 / D-13 | `listing.condition_code` es enum fijo `NEW`/`LIKE_NEW`/`GOOD`/`FAIR`/`POOR`; la granularidad extra va en `attributes.condition_detail`. |
| C-11.4 / D-14 | No hay campos de archivado masivo ni `archived_by_suspension`; la invisibilidad se calcula con el predicado de visibilidad. |
| C-11.5 / D-16 | `moderation_case` sin `status`: `decision` (`PENDING`, `RESOLVED_UPHELD`, `RESOLVED_DISMISSED`), `decided_by`, `decided_at`, `resolution_note`. |
| C-11.6 | No hay columna ni índice que garantice un único `OWNER`; la regla vive en `CreateMembership`. |
