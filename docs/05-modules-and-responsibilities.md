# 05 — Módulos y responsabilidades (backend)

**Estado:** documento para revisión · **Fecha:** 2026-11-12 · **Fase:** planificación (Prompt 01)
**Base:** [03-system-architecture.md](03-system-architecture.md) § 4 · [04-domain-overview.md](04-domain-overview.md)

---

## 0. Cómo leer este documento

Cada módulo se describe con la misma ficha: propósito, datos que gobierna, casos de uso (incluidos y **excluidos**), adaptadores de entrada, puertos de salida, adaptadores de infraestructura, dependencias permitidas y prohibidas, eventos, riesgos de acoplamiento y pruebas críticas.

**Convenciones**

- `UC-xx` = caso de uso. `EV-xx` = evento. Rutas REST indicativas (el contrato definitivo es del Prompt 02/03).
- "Prohibido" significa **prohibido por diseño**, no "no recomendado". Se puede verificar con lint y revisión.
- Los puertos son del consumidor cuando cruzan módulos (`Reader`), y del módulo cuando son infraestructura propia (`Repository`, `Mailer`).

### 0.1 Evaluación de la lista de módulos

La lista del brief se evaluó; el resultado incluye **una fusión y una separación** justificadas:

| Propuesta | Decisión | Motivo |
|-----------|----------|--------|
| `Verticals` + `Categories` + `Attributes` → un módulo **Taxonomy** | **FUSIONAR (PROPUESTA)** | Comparten agregado conceptual (la definición del sector), se administran juntos y se leen juntos. Separarlos obliga a tres puertos y tres ciclos de vida para un mismo cambio de configuración. |
| `Subscriptions` + `Billing` → ¿uno? | **MANTENER SEPARADOS (PROPUESTA)** | `Subscriptions` posee el ciclo de vida y los límites (dominio propio); `Billing` registra el cobro manual y su auditoría. En el MVP `Billing` es delgado, pero separarlo deja el punto de extensión para la pasarela de fase 2 sin tocar el dominio. |
| `PublicCatalog` | **MANTENER, sin datos propios** | Es proyección de lectura. Su valor es tener un contrato público estable y consultas optimizadas, separado del modelo de escritura. |
| `Admin` | **MANTENER, delgado** | No contiene reglas de negocio; compone casos de uso ajenos y audita. Si engorda, se convierte en un segundo backend. |
| `Events` vs `Integrations` | **Un solo módulo `Events`** | Outbox, despacho y webhooks salientes son una sola responsabilidad; los webhooks entrantes del proveedor viven en `Billing` porque son específicos de ese proveedor. |
| `Auth` vs `Users` | **SEPARADOS** | `Auth` es credenciales/sesiones (infraestructura de identidad); `Users` es el perfil y la identidad de negocio. Cambian por motivos distintos (política de contraseñas vs. datos de perfil). |

---

## 1. Auth

**Propósito.** Autenticar usuarios, emitir y revocar sesiones, gestionar recuperación de contraseña y verificación de correo. Es el único módulo que conoce credenciales.

**Datos e invariantes que gobierna**

- `User` credencial (`passwordHash` Argon2id, `emailVerifiedAt`), `Session` (token opaco hasheado, expiración absoluta y por inactividad, revocación), `PasswordResetToken`, `EmailVerificationToken` (de un uso, con expiración).
- Invariantes: una sesión solo pertenece a un usuario; un token de recuperación se invalida al usarse; nunca se registra una contraseña en logs ni en auditoría.

**Casos de uso**

| ID | Caso de uso | Incluido |
|----|-------------|----------|
| UC-A01 | `RegisterUser` (email + contraseña, envía verificación) | ✅ |
| UC-A02 | `VerifyEmail` | ✅ |
| UC-A03 | `Login` (rate limit por IP y por email) | ✅ |
| UC-A04 | `Logout` (revoca sesión actual) | ✅ |
| UC-A05 | `LogoutAllSessions` | ✅ |
| UC-A06 | `RequestPasswordReset` | ✅ |
| UC-A07 | `ResetPassword` (revoca todas las sesiones) | ✅ |
| UC-A08 | `ChangePassword` (autenticado) | ✅ |
| UC-A09 | `ResolveSession` (usado por el guard en cada petición) | ✅ |
| UC-A10 | Login con proveedor externo (Google, etc.) | ❌ Fase 2 |
| UC-A11 | MFA/TOTP | ❌ Fase 2 (excepto para `PLATFORM_ADMIN`, evaluar) |
| UC-A12 | Gestión de dispositivos y sesiones activas en UI | ❌ Fase 2 |

**Adaptadores de entrada:** `AuthController` (`POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`*, `/auth/password-reset/*`, `/auth/verify-email`), guard `SessionAuthGuard` (usado por todos los módulos).

\* Con sesión por cookie no hay `refresh` de token; si se opta por JWT de acceso corto, este endpoint existe. Ver [07](07-security-and-multitenancy.md) § 3.

**Puertos de salida:** `UserCredentialRepository`, `SessionRepository`, `TokenRepository`, `PasswordHasher`, `Clock`, `RandomSource`, `RateLimiter`, `Mailer` (para verificación/recuperación).

**Adaptadores de infraestructura:** Prisma (`User`, `Session`, tokens), `Argon2PasswordHasher`, `RedisRateLimiter` **o** rate limiter en PostgreSQL (decisión MVP: en memoria por proceso + tabla de intentos — **PROPUESTA**), `SmtpMailer` / proveedor de correo (**PENDIENTE**).

**Dependencias permitidas:** `Users` (crear perfil al registrar), `Audit`, `Notifications`, `Events`.
**Prohibidas:** cualquier módulo de negocio (`Listings`, `Leads`, `Subscriptions`), `Prisma` fuera de `infrastructure/`, exponer `passwordHash` en respuestas o eventos.

**Eventos:** publica `UserRegistered`, `UserEmailVerified`, `UserPasswordResetRequested`, `UserLoggedIn` (analítico, no de dominio), `UserSuspended`. Consume: ninguno.

**Riesgos de acoplamiento:** que los guards de autorización de negocio se implementen aquí (mezclaría identidad con tenancy); que `Auth` consulte datos de negocio para decidir acceso.

**Pruebas críticas:** fuerza bruta (límite y bloqueo temporal), enumeración de usuarios (respuesta idéntica exista o no), token de recuperación reutilizado, sesión revocada rechazada, contraseña débil rechazada, hash con parámetros verificados.

---

## 2. Users

**Propósito.** Identidad de la persona y sus datos de perfil. No autentica.

**Datos e invariantes:** `User` (nombre, email verificado, teléfono opcional, estado, preferencias de notificación, aceptación de términos con fecha y versión). Email normalizado y único; un usuario `SUSPENDED` no opera.

**Casos de uso:** `GetMyProfile` ✅, `UpdateMyProfile` ✅, `AcceptTerms` ✅, `RequestAccountDeletion` ✅ (soft delete + anonimización diferida), `ListUsers` (solo `PLATFORM_ADMIN`) ✅, `SuspendUser` (Admin, auditado) ✅. Excluidos: gestión de contraseñas (Auth), membresías (Businesses), direcciones (no aplica).

**Entrada:** `UsersController` (`GET/PATCH /me`, `DELETE /me`, `GET /admin/users`).
**Puertos:** `UserRepository`, `AuditWriter`, `EventPublisher`.
**Infra:** Prisma.
**Permitidas:** `Audit`, `Events`. **Prohibidas:** `Auth` (no debe depender de credenciales), `Listings`, `Leads`.
**Eventos:** `UserProfileUpdated`, `UserDeletionRequested`. Consume: `UserRegistered` (crea perfil si no existe).

**Riesgos:** que `Users` se convierta en el lugar donde se resuelven permisos. Los permisos se resuelven por `Membership` + rol de plataforma.
**Pruebas:** un usuario no puede leer ni modificar el perfil de otro; eliminación respeta retención legal.

---

## 3. Businesses

**Propósito.** Gobierna el negocio (tenant), sus membresías y roles, su habilitación por vertical y su perfil público.

**Datos e invariantes:** `Business` (nombre, slug, descripción, teléfono comercial, `city` del catálogo de 10 municipios, `addressLine` opcional, estado, logo), `Membership` (usuario, negocio, rol, estado de invitación), `BusinessVertical` (habilitación), `BusinessSlugHistory`. Invariantes I-08, I-09, y: no se puede revocar el último `OWNER`; un negocio `SUSPENDED` no publica.

**Casos de uso**

| ID | Caso de uso | Incluido |
|----|-------------|----------|
| UC-B01 | `RegisterBusiness` (crea negocio **`APPROVED`** + membresía `OWNER`; sin revisión previa) | ✅ |
| UC-B02 | `UpdateBusinessProfile` | ✅ |
| UC-B03 | ~~`SubmitForVerification`~~ | ❌ **Eliminado** (Q-07) |
| UC-B04 | ~~`ApproveBusiness` / `RejectBusiness`~~ | ❌ **Eliminado** (Q-07); la única acción de plataforma es `SuspendBusiness`/`ReactivateBusiness` |
| UC-B05 | `SuspendBusiness` / `ReactivateBusiness` (Admin/Moderation, con `ModerationCase`) | ✅ |
| UC-B06 | `EnableVertical` / `DisableVertical` | ✅ |
| UC-B07 | `InviteMember` (email, rol, expiración) | ⚠️ **Fuera del MVP** (1 miembro); el modelo y el caso de uso quedan definidos |
| UC-B08 | `AcceptInvitation` | ⚠️ Igual que UC-B07 |
| UC-B09 | `ChangeMemberRole` | ⚠️ Igual que UC-B07 |
| UC-B10 | `RemoveMember` (con regla del último OWNER) | ⚠️ Igual que UC-B07 |
| UC-B11 | `TransferOwnership` | ⚠️ Fase 2 |
| UC-B12 | `ListMyBusinesses` (para el selector de contexto) | ✅ |
| UC-B13 | Sucursales múltiples | ❌ (D-02) |
| UC-B14 | Verificación documental automática (RUT, cámara) | ❌ Fase 2 |

**Entrada:** `BusinessesController` (`POST /businesses`, `GET /businesses`, `GET/PATCH /businesses/:businessId`, `POST /businesses/:businessId/verticals`, `.../members`, `.../members/:userId`), `BusinessInvitationsController` (`POST /invitations/:token/accept`), `PublicBusinessController` (perfil público, delega en catálogo).
**Puertos:** `BusinessRepository`, `MembershipRepository`, `UserDirectory` (leer email/nombre de usuarios), `InvitationSender` (vía Notifications), `EntitlementReader` (para límites de miembros si el plan los define), `AuditWriter`, `EventPublisher`, `SlugGenerator`.
**Infra:** Prisma, servicio de correo para invitaciones.

**Permitidas:** `Users`, `Taxonomy` (solo lectura de verticales activas), `Notifications`, `Audit`, `Events`, `Subscriptions` (lectura de entitlements).
**Prohibidas:** escribir en `Listings`, `Leads`, `Subscription`; importar `PublicCatalog`; resolver autorización de plataforma (eso es de Admin/Moderation).

**Eventos:** `BusinessRegistered`, `BusinessSuspended`, `BusinessReactivated`, `BusinessProfileUpdated`, `BusinessVerticalEnabled`, `BusinessVerticalRevoked`, `MemberInvited`, `MemberJoined`, `MemberRoleChanged`, `MemberRemoved`, `OwnershipTransferred`. Consume: `SubscriptionExpired` (para marcar restricción), `UserDeletionRequested` (anonimizar membresías).

**Riesgos de acoplamiento:** que la habilitación de vertical se consulte en cada request desde `Listings` con una llamada directa al repositorio; debe ir por `Reader` cacheado. Que las invitaciones se envíen de forma síncrona y bloqueen la respuesta.
**Pruebas críticas:** invitar/aceptar con token vencido; revocar último owner; usuario de negocio A no puede ver ni modificar miembros de B; aprobación idempotente; cambio de slug conserva redirección.

---

## 4. Taxonomy (Verticals + Categories + Attributes)

**Propósito.** Definir el negocio variable: qué sectores existen, cómo se clasifican sus artículos y qué atributos los describen. Es la pieza que permite abrir una vertical nueva **sin desplegar código**. **[APROBADA como requisito]**

**Datos e invariantes:** `Vertical` (slug, nombre, estado, orden, configuración de catálogo), `Category` (árbol por vertical, slug único por vertical, sin ciclos), `AttributeDefinition` (key, tipo `TEXT|NUMBER|BOOLEAN|ENUM|DATE|MEASURE`, obligatoriedad, opciones, unidad, `filterable`, `sortable`, `searchable`, orden, ámbito vertical o categoría), `AttributeOption`.

**Casos de uso**

| ID | Caso de uso | Incluido |
|----|-------------|----------|
| UC-T01 | `CreateVertical` / `UpdateVertical` / `Activate` / `Deactivate` | ✅ |
| UC-T02 | `CreateCategory` / `MoveCategory` / `RenameCategory` / `DeactivateCategory` | ✅ |
| UC-T03 | `CreateAttributeDefinition` / `UpdateAttributeDefinition` / `Deactivate` | ✅ |
| UC-T04 | `ReorderAttributes` (afecta el formulario de publicación) | ✅ |
| UC-T05 | `ValidateAttributeValues` (servicio de dominio expuesto a `Listings`) | ✅ |
| UC-T06 | `GetPublicTaxonomy` (verticales y categorías activas para el catálogo) | ✅ |
| UC-T07 | `MigrateAttributeType` (conversión de valores existentes) | ❌ MVP: se exige migración manual aprobada (R-23) |
| UC-T08 | Traducciones por idioma | ❌ Fase 3 |
| UC-T09 | Atributos calculados o dependientes entre sí (reglas condicionales) | ❌ Fase 2 |

**Entrada:** `AdminTaxonomyController` (`POST/PATCH /admin/verticals`, `/admin/categories`, `/admin/attributes`), `PublicTaxonomyController` (`GET /public/verticals`, `GET /public/verticals/:slug/categories`).

**Puertos:** `TaxonomyRepository` (escritura), `TaxonomyReader` (lectura optimizada, consumida por otros módulos), `SlugGenerator`, `EventPublisher`, `AuditWriter`, `CacheInvalidator`.

**Infra:** Prisma; caché en memoria con invalidación por evento (la taxonomía cambia poco y se lee mucho).

**Permitidas:** `Admin` (invoca), `Audit`, `Events`. **Prohibidas:** `Listings`, `Leads`, `Businesses` (no debe conocer publicaciones ni negocios; si necesita contar uso, se lo informa el consumidor).
**Eventos:** `VerticalCreated`, `VerticalDeactivated`, `CategoryCreated`, `CategoryDeactivated`, `AttributeDefinitionCreated`, `AttributeDefinitionUpdated`. Consume: ninguno.

**Riesgos de acoplamiento:** que las validaciones de atributos se dupliquen en `Listings` y en `Taxonomy` (debe haber **una** autoridad: `ValidateAttributeValues`); que el catálogo consulte la taxonomía con N+1 consultas por request.
**Pruebas críticas:** ciclos en el árbol; categoría de otra vertical asignada a publicación (rechazo); atributo obligatorio ausente (rechazo); desactivar vertical no borra publicaciones; validación de tipo y opciones; cambio de opciones con valores existentes.

---

## 5. Listings

**Propósito.** Gobierna las publicaciones y su ciclo de vida: creación, edición, imágenes, atributos, precio y transiciones de estado. Es el agregado central del producto.

**Datos e invariantes:** `Listing` (título, descripción, precio en COP, `condition`, `quantity`, categoría, vertical, negocio, estado, fechas, contador de vistas si se aprueba), `ListingAttributeValue`, historial de estados. Invariantes I-01 a I-06; R-05 a R-09.

**Casos de uso**

| ID | Caso de uso | Incluido |
|----|-------------|----------|
| UC-L01 | `CreateListingDraft` | ✅ |
| UC-L02 | `UpdateListing` (solo `DRAFT`/`PAUSED`/`PUBLISHED` con reglas) | ✅ |
| UC-L03 | `AttachMedia` / `RemoveMedia` / `ReorderMedia` (vía Media) | ✅ |
| UC-L04 | ~~`SubmitForReview`~~ | ❌ **Eliminado** (Q-07: publicación directa) |
| UC-L05 | `PublishListing` (valida política completa y publica en el mismo paso) | ✅ |
| UC-L06 | `PauseListing` / `ResumeListing` | ✅ |
| UC-L07 | `MarkListingSold` | ✅ |
| UC-L08 | `ArchiveListing` / `DeleteListingDraft` | ✅ |
| UC-L09 | `DuplicateListing` (copia en `DRAFT`) | ⚠️ Fase 2 (no MVP) |
| UC-L10 | `ExpireListing` (job) | ✅ |
| UC-L11 | `ListMyListings` (filtros por estado, paginación) | ✅ |
| UC-L12 | `ArchiveListing` desde Moderación (denuncia) | ✅ (reemplaza a `ApproveListing`/`RejectListing`) |
| UC-L13 | Edición masiva (precio, estado) | ❌ Fase 2 |
| UC-L14 | Historial de cambios visible al negocio | ❌ Fase 2 (solo auditoría interna) |
| UC-L15 | Reservas o apartados | ❌ |

**Entrada:** `ListingsController` (`GET/POST /businesses/:businessId/listings`, `GET/PATCH/DELETE /businesses/:businessId/listings/:listingId`, `POST .../publish`, `.../pause`, `.../resume`, `.../sold`, `.../archive`), `ListingExpiryJob` (worker), `ModerationDecisionHandler` (evento interno).

**Puertos:** `ListingRepository`, `TaxonomyReader`, `EntitlementReader`, `MediaReader`, `BusinessReader` (estado y verticales habilitadas), `PolicyReader` (expiración y ventana de edición), `OutboxWriter`, `Clock`, `CacheInvalidator`.

**Infra:** Prisma, caché de catálogo (invalidación), outbox.

**Permitidas:** `Businesses` (lectura), `Taxonomy` (lectura), `Media` (lectura + comandos), `Subscriptions` (lectura de entitlements), `Moderation` (recibe decisiones), `Events`, `Audit`.
**Prohibidas:** `PublicCatalog` (nunca al revés), `Leads`, `Billing`, `Auth`, y **cualquier acceso directo a `PrismaService` fuera de `infrastructure/`**.

**Eventos:** `ListingCreated`, `ListingPublished`, `ListingPaused`, `ListingResumed`, `ListingSold`, `ListingArchived` (con `archivedReason`), `ListingPriceChanged`, `ListingAttributesChanged`. Consume: `ModerationCaseResolved` (archivar por denuncia), `SubscriptionExpired` (para ocultar), `BusinessSuspended`.

**Riesgos de acoplamiento:** consultar el plan dentro del agregado (debe ser puerto); recalcular visibilidad en el frontend (violación directa); publicar eventos **fuera** de la transacción (pérdida de eventos); N+1 al listar publicaciones con atributos e imágenes.
**Pruebas críticas:** publicar sin imagen → rechazo; publicar excediendo cupo → rechazo; categoría de otra vertical → rechazo; transición ilegal (`DRAFT → SOLD`) → rechazo; publicar con `city` de negocio fuera del catálogo → rechazo; marcar vendido oculta del catálogo en ≤ 60 s; publicar dos veces es idempotente; evento emitido exactamente una vez por transición efectiva.

---

## 6. Media

**Propósito.** Gestionar el ciclo de vida de archivos e imágenes: autorización de carga, validación real, procesamiento, entrega y eliminación. Mantiene el proveedor intercambiable.

**Datos e invariantes:** `MediaAsset` (negocio, entidad propietaria, `storageKey`, MIME real, tamaño, dimensiones, hash, estado `PENDING|UPLOADED|READY|REJECTED|DELETED`, variantes). Invariantes: un asset pertenece a un negocio y a un solo propietario lógico; jamás se sirve un archivo no validado; la clave de almacenamiento es opaca.

**Casos de uso:** `RequestUploadUrl` (presigned PUT con límites) ✅, `ConfirmUpload` (verifica objeto, encola procesamiento) ✅, `ProcessMedia` (validación de bytes, extracción de metadatos, variantes, strip EXIF) ✅, `DeleteMedia` (soft + purga diferida) ✅, `GetSignedUrl` (entrega) ✅, `SetBusinessLogo` ✅. Excluidos: edición de imagen en navegador (Fase 2), video (❌), documentos (❌), antivirus dedicado (PENDIENTE, ver 07).

**Entrada:** `MediaController` (`POST /businesses/:businessId/media/upload-url`, `POST /media/:assetId/confirm`, `DELETE /media/:assetId`), `MediaProcessingJob` (worker).
**Puertos:** `MediaRepository`, `ObjectStorage` (`putObject`, `headObject`, `getObjectRange`, `deleteObject`, `signGet`, `signPut`), `ImageProcessor` (`inspect`, `stripMetadata`, `resize`), `MalwareScanner` (opcional), `OwnershipReader`, `EventPublisher`, `Clock`.

**Infra:** S3-compatible (R2 candidato), `sharp` para imágenes, cola/outbox para procesamiento.

**Permitidas:** `Businesses` (verificar pertenencia), `Listings` (asociar), `Events`, `Audit`.
**Prohibidas:** decidir visibilidad pública (eso es de Listings/Catalog), servir binarios a través de la API en producción (se sirve por CDN/URL firmada), aceptar archivos sin verificar bytes reales.

**Eventos:** `MediaUploaded`, `MediaProcessed`, `MediaRejected`, `MediaDeleted`. Consume: `ListingArchived` (purga diferida opcional).

**Riesgos de acoplamiento:** que `Listings` escriba directamente en `MediaAsset`; que el frontend construya URLs de storage; que el procesamiento sea síncrono en la petición de confirmación.
**Pruebas críticas:** archivo con MIME falsificado (`.jpg` que es HTML) → rechazo; tamaño excedido → rechazo; más imágenes del límite → rechazo; usuario de otro negocio no puede confirmar ni borrar; URL firmada expira; asset rechazado nunca aparece en el catálogo.

---

## 7. PublicCatalog

**Propósito.** Servir el catálogo público agregado: portada, navegación por vertical, búsqueda, filtros, ordenamiento, paginación, detalle de publicación y perfil de negocio. **No posee datos ni duplica inventario.** **[APROBADA]**

**Datos que gobierna:** ninguno propio. Consulta `Listing`, `MediaAsset`, `Business`, `Vertical`, `Category`, `AttributeDefinition/Value` y `Subscription` (solo para la regla de visibilidad R-01). Es una **proyección**.

**Casos de uso**

| ID | Caso de uso | Incluido |
|----|-------------|----------|
| UC-C01 | `GetHome` (verticales destacadas, publicaciones recientes) | ✅ |
| UC-C02 | `GetVerticalLanding` (categorías, filtros disponibles) | ✅ |
| UC-C03 | `SearchListings` (texto + filtros + orden + paginación keyset) | ✅ |
| UC-C04 | `GetListingDetail` (por slug o id, con negocio y relacionadas del mismo negocio) | ✅ |
| UC-C05 | `GetBusinessPublicProfile` (datos públicos + publicaciones activas) | ✅ |
| UC-C06 | `GetFilterFacets` (valores y conteos por filtro) | ✅ (con límites) |
| UC-C07 | `GetSitemapData` (URLs y fechas de modificación) | ✅ |
| UC-C08 | Recomendaciones personalizadas | ❌ Fase 3 |
| UC-C09 | Búsqueda por geolocalización ("cerca de mí") | ❌ Fase 3 (requiere coordenadas/PostGIS) |
| UC-C10 | Comparador / favoritos | ❌ Fase 2 |

**Entrada:** `CatalogController` (`GET /public/home`, `/public/verticals/:slug`, `/public/listings`, `/public/listings/:idOrSlug`, `/public/businesses/:slug`), `SitemapController` (`GET /public/sitemap`).
**Puertos:** `CatalogQueryPort` (consultas SQL/Prisma optimizadas), `VisibilityPolicy` (regla R-01 en un solo lugar), `CacheStore` (opcional, con tags), `Clock`.

**Infra:** Prisma (solo lectura), caché de aplicación/HTTP.

**Permitidas:** lectura de `Listings`, `Businesses`, `Taxonomy`, `Media`, `Subscriptions` (solo entitlements de visibilidad).
**Prohibidas:** **cualquier escritura**; importar repositorios de escritura; contener reglas de publicación; almacenar copias del inventario; exponer datos privados del negocio (email personal, dirección exacta si no es pública).

**Eventos:** publica `CatalogListingViewed` (analítico, muestreado, **PENDIENTE** por privacidad). Consume: `ListingPublished`, `ListingSold`, `ListingPaused`, `ListingArchived`, `BusinessSuspended` (para invalidar caché).

**Riesgos de acoplamiento:** que la regla de visibilidad se reimplemente en SQL y en el frontend (debe ser **una**); que el catálogo consulte la tabla de suscripciones con joins costosos; que los filtros dinámicos generen SQL no parametrizado (riesgo de inyección).
**Pruebas críticas:** publicación de negocio suspendido no aparece; publicación de suscripción vencida no aparece; filtro por atributo devuelve solo valores de esa vertical; paginación estable con inserciones concurrentes (keyset); detalle de publicación oculta → 404; perfil de negocio no filtra datos privados; facetas no superan el límite de valores.

---

## 8. Leads

**Propósito.** Persistir y gestionar los contactos enviados por el formulario web, asociados a un negocio y opcionalmente a una publicación. **No** registra clics de WhatsApp. **[APROBADA]**

**Datos e invariantes:** `Lead` (negocio, publicación opcional, nombre, email, teléfono, mensaje, consentimiento con versión de política, origen, estado, notas internas, `idempotencyKey`, IP hasheada, user-agent resumido). Invariantes I-10, I-11; R-11, R-12, R-13.

**Casos de uso:** `SubmitLead` (público, rate limited, idempotente) ✅, `ListLeads` (panel, filtros por estado y publicación) ✅, `GetLead` ✅, `UpdateLeadStatus` ✅, `AddLeadNote` ✅, `ExportLeadsCsv` ❌ Fase 2, `AssignLeadToMember` ❌ (D-05), `ReplyToLeadFromPlatform` ❌ (se responde por fuera).

**Entrada:** `PublicLeadsController` (`POST /public/listings/:listingId/leads`, `POST /public/businesses/:slug/leads`), `LeadsController` (`GET /businesses/:businessId/leads`, `PATCH .../leads/:leadId`).
**Puertos:** `LeadRepository`, `ListingReader` (resolver negocio/vertical desde publicación), `BusinessReader` (estado y contacto), `Notifier`, `RateLimiter`, `IdempotencyStore`, `Clock`, `EventPublisher`, `AuditWriter`.

**Infra:** Prisma, correo/notificación, rate limiter.

**Permitidas:** `Listings` (lectura), `Businesses` (lectura), `Notifications`, `Audit`, `Events`.
**Prohibidas:** escribir en `Listing` (un lead no cambia el estado de la publicación), leer datos de otros negocios, exponer leads a usuarios no miembros, incluir el mensaje completo en logs.

**Eventos:** `LeadSubmitted`, `LeadStatusChanged`. Consume: `BusinessSuspended` (bloquear nuevos leads), `ListingArchived` (mantener el lead, marcar la publicación como no disponible).

**Riesgos de acoplamiento:** que el formulario llame directamente a `Notifications` (debe pasar por el caso de uso) y que el envío se bloquee esperando el correo; que la idempotencia se implemente en el frontend.
**Pruebas críticas:** doble submit con la misma `Idempotency-Key` crea **un** lead; spam supera el límite y recibe 429; lead a publicación de otro negocio es rechazado; negocio B no ve leads de A; consentimiento obligatorio; lead sin publicación válido.

---

## 9. Subscriptions

**Propósito.** Gobierna planes, suscripciones del negocio y **entitlements** (límites y capacidades). Es la autoridad de "qué puede hacer este negocio".

**Datos e invariantes:** `Plan` (código, nombre, precio de referencia en COP, límites versionados), `PlanEntitlement` (clave/valor: publicaciones activas, imágenes por publicación, miembros, panel de leads), `Subscription` (negocio, plan, estado, periodo, `activatedByAdminId`, `activationNote`, cancelación programada). Invariantes I-07, I-14; R-20 a R-23.

**Casos de uso:** `ListPlans` (público) ✅, `GetMySubscription` ✅, `RequestPlan` (el plan Free arranca en `TRIALING` con 60 días; un plan de pago se aplica cuando el admin confirma el pago, sin estado intermedio) ✅, `ActivateManually(subscriptionId, note, periodEnd)` (solo `PLATFORM_ADMIN`/`FINANCE`) ✅, `ChangePlan` ✅, `CancelSubscription` (al final del periodo) ✅, `GetEntitlements` (interno, para otros módulos) ✅, `ExpireSubscriptions` (job) ✅, `Prorrateo` ❌ (sin pasarela no aplica), `Facturación electrónica` ❌ (proveedor estándar cuando haya cobros).

**Entrada:** `SubscriptionsController` (`GET /plans`, `GET /businesses/:businessId/subscription`, `POST .../subscription`, `POST .../subscription/cancel`), `AdminSubscriptionsController` (`POST /admin/subscriptions/:id/activate`), `SubscriptionExpiryJob`.
**Puertos:** `PlanRepository`, `SubscriptionRepository`, `EntitlementCache`, `Clock`, `EventPublisher`, `Notifier`, `AuditWriter`.

**Infra:** Prisma, caché corta de entitlements (invalidada por evento).

**Permitidas:** `Businesses` (lectura), `Notifications`, `Audit`, `Events`.
**Prohibidas:** procesar pagos o llamar a un proveedor (no hay pasarela en el MVP), decidir visibilidad del catálogo (solo expone entitlements), aceptar `planId` sin validar contra catálogo de planes, activar sin nota ni actor.

**Eventos:** `SubscriptionActivated`, `SubscriptionCancelled`, `SubscriptionExpired`, `SubscriptionPlanChanged`, `EntitlementsChanged`. Consume: `BusinessRegistered` (iniciar plan Free si aplica), `BusinessClosed` (cancelar).

**Riesgos de acoplamiento:** que cada módulo consulte la tabla de suscripciones directamente (debe usar `EntitlementReader`); que los límites se dupliquen en frontend; que el estado dependa de un cron y no de eventos + fechas.
**Pruebas críticas:** Free activa al instante y vence a los 2 meses; plan de pago no habilita nada hasta la activación manual; activación sin nota → 422; doble activación no extiende el periodo ni duplica eventos; downgrade no rompe publicaciones existentes (solo bloquea nuevas); expiración oculta el catálogo.

---

## 10. Billing (registro manual de cobros)

**Propósito.** Registrar el cobro **manual** de suscripciones (transferencia o Nequi): quién lo confirmó, cuándo, por qué periodo y con qué nota. **No procesa compras de artículos y no integra pasarela en el MVP** (Q-06, C-10). **[APROBADA]**

**Datos e invariantes:** no tiene tablas propias: escribe `Subscription.activatedByAdminId` y `Subscription.activationNote` a través del caso de uso de `Subscriptions`, y deja rastro en `Audit`. Invariantes: ninguna activación sin actor de plataforma autorizado y sin nota; el estado de la suscripción **nunca** se cambia por un parámetro del cliente.

**Casos de uso:** `RecordManualPayment(subscriptionId, note, externalReference?)` ✅, `ActivateSubscription` (delega en `Subscriptions.ActivateManually`) ✅, `ListPendingActivations` ✅. Excluidos: `CreateCheckoutSession`, `HandleProviderWebhook`, `ListInvoices`, `Refund`, `Dunning` (todos fase 2, cuando exista pasarela).

**Entrada:** `AdminBillingController` (`GET /admin/subscriptions/pending`, `POST /admin/subscriptions/:id/activate`).
**Puertos:** `SubscriptionActivationPort` (del módulo Subscriptions), `AuditWriter`, `Clock`, `EventPublisher`.

**Infra:** Prisma (vía Subscriptions), auditoría.

**Permitidas:** `Subscriptions` (aplicar activación), `Businesses` (lectura), `Notifications`, `Audit`, `Events`.
**Prohibidas:** contener reglas de planes o límites (son de Subscriptions), guardar datos de tarjetas o comprobantes con datos personales innecesarios, activar sin registro de auditoría, recibir webhooks (no aplica).

**Eventos:** ninguno propio; la activación emite `SubscriptionActivated` desde Subscriptions.
**Consume:** nada en el MVP.

**Riesgos de acoplamiento:** que la activación se haga por SQL directo saltándose `Subscriptions`; que la nota se guarde sin actor; error humano al activar el plan equivocado (ver R-32).
**Pruebas críticas:** activación sin rol → 403; activación sin nota → 422; doble clic → idempotente; queda rastro en auditoría; el negocio no puede activarse a sí mismo.

---

## 11. Moderation (solo reactiva)

**Propósito.** Gestionar denuncias y aplicar decisiones (ocultar publicación, suspender negocio, desestimar) con trazabilidad. **No hay revisión previa** (Q-07, C-10).

**Datos e invariantes:** `ModerationCase` (objeto revisado, motivo, estado, decisión, actor, fechas), `Report` (denunciante opcional, motivo tipificado, evidencia). Invariantes: toda decisión tiene actor y motivo; una decisión es inmutable (se corrige con una nueva); ocultar una publicación no la borra.

**Casos de uso:** `SubmitReport` (público/autenticado) ✅, `OpenCase` (a partir de una denuncia) ✅, `ListOpenCases` ✅, `DecideCase` (ocultar/suspender/desestimar) ✅, `ResolveReport` ✅, `AppealDecision` ❌ Fase 2, `AutomaticContentDetection` ❌ Fase 3.

**Entrada:** `ModerationController` (`GET /moderation/cases`, `POST /moderation/cases/:id/decide`), `PublicReportsController` (`POST /public/reports`).
**Puertos:** `ModerationCaseRepository`, `ReportRepository`, `BusinessReader`, `ListingReader`, `AuditWriter`, `Notifier`, `EventPublisher`.

**Infra:** Prisma, correo (aviso de decisión).

**Permitidas:** `Businesses`, `Listings` (aplicar decisión vía caso de uso), `Notifications`, `Audit`, `Events`.
**Prohibidas:** modificar directamente el estado de una publicación o negocio (debe invocar el caso de uso del dueño), decidir sin actor identificado, abrir casos sin denuncia o evidencia, borrar evidencia.

**Eventos:** `ModerationCaseOpened`, `ModerationCaseResolved`, `ReportSubmitted`. Consume: `ReportSubmitted` (crea el caso).
**Riesgos de acoplamiento:** que `Moderation` escriba `Listing.status` por SQL directo (rompe invariantes y auditoría); que la cola no tenga prioridad y lo urgente (contenido ilícito) espere.
**Pruebas críticas:** decisión aplicada una sola vez; suspensión notifica al negocio; usuario sin rol de moderador no accede; reporte duplicado del mismo usuario no genera dos casos; auditoría registra actor y motivo.

---

## 12. Admin

**Propósito.** Capacidades globales de administración y soporte: gestión de usuarios y roles de plataforma, configuración de taxonomía y planes (delegando en sus módulos), y acceso auditado a información para soporte. **Delgado por diseño.**

**Datos e invariantes:** `PlatformRoleAssignment` (usuario, rol de plataforma, actor, fecha). Invariante: ningún rol de plataforma otorga escritura sobre datos de negocio sin acción explícita y auditada.

**Casos de uso:** `AssignPlatformRole` ✅, `RevokePlatformRole` ✅, `ListUsers`/`SearchUsers` ✅, `ImpersonateForSupport` ⚠️ **PENDIENTE** (alto riesgo; si se aprueba, requiere doble control y auditoría reforzada), `ViewAuditLog` ✅, `ConfigurePlatformSettings` (expiración de publicaciones, límites globales, catálogo de municipios del Valle de Aburrá) ✅, `ManagePlans` (delega en Subscriptions) ✅, `ActivateSubscriptionManually` (delega en Billing/Subscriptions) ✅. Excluidos: editar publicaciones de negocios, cambiar suscripciones sin registro de auditoría, moderar contenido (eso es Moderation).

**Entrada:** `AdminController` (`/admin/users`, `/admin/roles`, `/admin/settings`, `/admin/audit`).
**Puertos:** `PlatformRoleRepository`, `UserDirectory`, `AuditWriter`, `SettingsRepository`, `EventPublisher`.

**Infra:** Prisma.

**Permitidas:** `Users`, `Taxonomy`, `Subscriptions` (casos de uso), `Audit`, `Moderation` (lectura), `Events`.
**Prohibidas:** lógica de negocio propia, escritura directa en `Listing`/`Lead`/`Business`, saltarse la auditoría, exponer datos personales en listados de soporte.

**Eventos:** `PlatformRoleAssigned`, `PlatformRoleRevoked`, `PlatformSettingChanged`. Consume: ninguno.

**Riesgos de acoplamiento:** convertirse en "módulo Dios" que todo lo toca; que el soporte tenga acceso permanente en lugar de temporal y auditado.
**Pruebas críticas:** un `SUPPORT` no puede modificar; toda acción de admin genera auditoría; roles no escalan privilegios por combinación.

---

## 13. Notifications

**Propósito.** Entregar mensajes al usuario por canales autorizados (email en MVP) con plantillas versionadas, deduplicación y registro de entrega. **No conoce reglas de negocio**: recibe comandos de notificación.

**Datos e invariantes:** `NotificationTemplate` (código, versión, canal, asunto, cuerpo, variables permitidas), `Notification` (destinatario, plantilla, datos, `dedupKey`, estado, intentos, error resumido), preferencias de usuario. Invariante: un `dedupKey` produce un envío; nunca se registran secretos ni cuerpos completos con datos sensibles.

**Casos de uso:** `SendTemplatedEmail` ✅, `SendBulk` (acotado) ✅, `RetryFailed` (job) ✅, `UpdatePreferences` ✅, `SendSms` ❌, `SendPush` ❌ Fase 2, `SendWhatsAppMessage` ❌ **nunca** (WhatsApp es enlace externo, no canal de la plataforma).

**Entrada:** `NotificationCommandHandler` (interno, invocado por otros módulos y por eventos), `NotificationPreferencesController` (`GET/PATCH /me/notifications`), `NotificationRetryJob`.
**Puertos:** `NotificationRepository`, `TemplateRepository`, `EmailSender` (`send(message)`), `Clock`, `Metrics`.

**Infra:** proveedor de correo (**PENDIENTE**), Prisma.

**Permitidas:** `Users` (destinatarios), `Events`. **Prohibidas:** decidir a quién notificar según reglas de negocio (lo decide el módulo que emite el comando), leer datos de negocio para componer el mensaje (se le pasan las variables).
**Eventos:** `NotificationSent`, `NotificationFailed`. Consume: eventos de otros módulos **solo** como disparadores de plantillas registradas (mapeo explícito, no genérico).

**Riesgos de acoplamiento:** que cada módulo envíe correos por su cuenta (sin plantillas ni deduplicación); que un fallo del proveedor bloquee un flujo de negocio (debe ser asíncrono).
**Pruebas críticas:** deduplicación; reintento no duplica; plantilla sin variable obligatoria falla en validación; proveedor caído no rompe el caso de uso origen; sin datos sensibles en logs.

---

## 14. Audit

**Propósito.** Registrar de forma append-only las acciones sensibles: quién, qué, cuándo, desde dónde y con qué resultado.

**Datos e invariantes:** `AuditEntry` (actor, rol efectivo, acción, tipo y id de objeto, negocio, resultado, `requestId`, IP resumida, user-agent resumido, timestamp, metadatos no sensibles). Invariante: **inmutable**; no se actualiza ni se borra (salvo política de retención); nunca contiene contraseñas, tokens, tarjetas ni el contenido de un lead.

**Casos de uso:** `RecordAuditEntry` (interno) ✅, `QueryAuditLog` (Admin) ✅, `ExportAuditLog` ✅ (con límites), `VerifyIntegrity` (hash encadenado) ❌ Fase 2.

**Entrada:** `AuditController` (`GET /admin/audit`), `AuditCommandHandler` (interno, invocado por casos de uso).
**Puertos:** `AuditRepository`, `Clock`, `RequestContext` (actor, IP, requestId).

**Infra:** Prisma (tabla append-only; sin `UPDATE`/`DELETE` en el repositorio).

**Permitidas:** ninguna dependencia de negocio (solo recibe datos). **Prohibidas:** consultar otros módulos, tomar decisiones, registrar datos personales innecesarios.
**Eventos:** ninguno propio (la auditoría **no** se publica como evento de negocio para evitar fugas).

**Riesgos:** que se registre de más (PII) o de menos (acciones sin rastro); que el log de auditoría se use como bus de eventos.
**Pruebas críticas:** acciones de moderación/admin siempre auditadas; no se puede modificar una entrada; consulta filtrada por negocio no mezcla datos.

---

## 15. Events (Outbox + despacho + webhooks)

**Propósito.** Publicar eventos de dominio de forma confiable y entregarlos a consumidores internos y externos (webhooks), sin acoplar el dominio a ningún consumidor — hoy ninguno, mañana n8n.

**Datos e invariantes:** `OutboxEvent` (id, tipo, versión, agregado, payload, `occurredAt`, `publishedAt`, intentos, último error), `WebhookEndpoint` (url, secreto cifrado, eventos suscritos, estado), `WebhookDelivery` (evento, endpoint, estado, intentos, respuesta resumida). Invariantes: el evento se escribe en la transacción del cambio; entrega at-least-once; el `eventId` es la clave de idempotencia del consumidor.

**Casos de uso:** `AppendToOutbox` (interno, misma transacción) ✅, `DispatchPending` (worker, `FOR UPDATE SKIP LOCKED`) ✅, `DeliverWebhook` (firma HMAC, timeout, reintentos con backoff) ✅, `ReplayEvent` (admin, auditado) ✅, `RegisterEndpoint` (admin) ✅, `DisableEndpoint` ✅. Excluidos: consumidores de negocio dentro del bus (los handlers internos son in-process y explícitos), cola externa (Kafka/RabbitMQ) ❌.

**Entrada:** `WebhookAdminController` (`/admin/webhooks`), `OutboxDispatcherJob`, `WebhookDeliveryJob`.
**Puertos:** `OutboxRepository`, `WebhookEndpointRepository`, `HttpClient` (con timeout y sin reintentos automáticos del cliente), `SecretCipher`, `Clock`, `Metrics`.

**Infra:** Prisma, HTTP saliente, secreto cifrado (KMS o variable de entorno — **PENDIENTE**).

**Permitidas:** nada del dominio (solo recibe eventos ya formados). **Prohibidas:** que un módulo de negocio dependa de `Events` para su lógica (solo para publicar), incluir datos personales en payloads de webhooks, reintentar indefinidamente.
**Eventos:** publica (hacia fuera) todos los de [04](04-domain-overview.md) § 11; consume: ninguno.

**Riesgos:** outbox creciendo sin límite (purga); webhooks con payload excesivo; secretos mal gestionados; un endpoint lento bloqueando el despacho.
**Pruebas críticas:** evento escrito aunque falle el despacho; entrega duplicada no rompe al consumidor (idempotencia por `eventId`); firma verificable por el receptor; reintentos con backoff y DLQ; endpoint caído no bloquea otros.

---

## 16. Matriz resumen

| Módulo | Agregados | Escrituras | Depende de (permitido) | Publica eventos | ¿Expone puerto de lectura? |
|--------|-----------|-----------|------------------------|-----------------|----------------------------|
| Auth | User (credencial), Session | ✅ | Users, Audit, Notifications, Events | 5 | ❌ |
| Users | User (perfil) | ✅ | Audit, Events | 2 | ✅ `UserDirectory` |
| Businesses | Business, Membership | ✅ | Users, Taxonomy, Notifications, Audit, Events, Subscriptions (lectura) | 13 | ✅ `BusinessReader` |
| Taxonomy | Vertical, Category, AttributeDefinition | ✅ | Audit, Events | 6 | ✅ `TaxonomyReader` |
| Listings | Listing | ✅ | Businesses, Taxonomy, Media, Subscriptions, Moderation, Events, Audit | 10 | ✅ `ListingReader` |
| Media | MediaAsset | ✅ | Businesses, Listings, Events, Audit | 4 | ✅ `MediaReader` |
| PublicCatalog | — (proyección) | ❌ | Listings, Businesses, Taxonomy, Media, Subscriptions (lectura) | 1 (analítico) | n/a |
| Leads | Lead | ✅ | Listings, Businesses, Notifications, Audit, Events | 2 | ❌ |
| Subscriptions | Plan, Subscription | ✅ | Businesses, Billing, Notifications, Audit, Events | 8 | ✅ `EntitlementReader` |
| Billing | Activaciones manuales (auditoría); sin tablas propias | ✅ | Subscriptions, Businesses, Notifications, Audit, Events | 5 | ❌ |
| Moderation | ModerationCase, Report | ✅ | Businesses, Listings, Notifications, Audit, Events | 4 | ❌ |
| Admin | PlatformRoleAssignment | ✅ | Users, Taxonomy, Subscriptions, Audit, Events | 3 | ❌ |
| Notifications | Notification | ✅ | Users, Events | 2 | ❌ |
| Audit | AuditEntry | ✅ (append) | — | 0 | ✅ `AuditReader` (solo Admin) |
| Events | OutboxEvent, WebhookEndpoint, WebhookDelivery | ✅ | — | n/a (transporta) | ❌ |

---

## 17. Reglas transversales de módulos

1. **Un módulo no importa el repositorio de otro.** Solo su API de aplicación o un `Reader`.
2. **Un controlador no contiene reglas.** Valida forma (DTO), resuelve contexto, llama al caso de uso y mapea errores. Nada más.
3. **Un caso de uso no conoce HTTP.** Recibe comandos, devuelve resultados o lanza errores de dominio.
4. **Un repositorio no decide.** Persiste y consulta; las reglas están en el dominio o en la aplicación.
5. **Un evento se escribe en la misma transacción** que el cambio que lo origina.
6. **Ningún módulo llama a un proveedor externo dentro de una transacción.**
7. **Los errores de dominio se mapean a HTTP en el borde**, en un único filtro, con formato `problem+json`.
8. **Los límites de plan se leen por puerto**, nunca por consulta directa a tablas de `Subscriptions`.
