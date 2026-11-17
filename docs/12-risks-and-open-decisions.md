# 12 — Riesgos, ambigüedades y decisiones abiertas

**Estado:** documento para revisión · **Fecha:** 2026-11-12 · **Fase:** planificación (Prompt 01)

---

## 1. Cómo leer este documento

- **Probabilidad / Impacto:** Alta · Media · Baja.
- **Prioridad:** P1 (resolver antes del Prompt 02), P2 (antes del MVP), P3 (puede esperar).
- Los riesgos **legales** no son asesoría jurídica; requieren validación profesional.

---

## 2. Riesgos técnicos

| ID | Riesgo | Prob. | Impacto | Mitigación | Prio |
|----|--------|:-----:|:-------:|-----------|:----:|
| R-01 | Fuga de datos entre negocios por una consulta sin filtro de tenant | Media | **Alto** | `businessId` obligatorio en repositorios, pruebas negativas N-01…N-15 en CI, revisión de código | P1 |
| R-02 | Inconsistencia entre publicación y evento (publicación visible sin evento o viceversa) | Media | Medio | Outbox en la misma transacción; pruebas de fallo inyectado | P1 |
| R-03 | Visibilidad incorrecta (publicación visible sin suscripción o negocio suspendido) | Media | **Alto** | `VisibilityPolicy` única, caché invalidada por evento, pruebas de matriz de visibilidad | P1 |
| R-04 | Complejidad de la arquitectura hexagonal frena al equipo | Media | Medio | Hexagonal solo donde hay reglas; CRUD simple directo; criterios escritos en ADR-002 | P2 |
| R-05 | Prisma 7 → 8 rompe el plan (tag `latest` ya apunta a RC) | Alta | Medio | Fijar versión exacta 7.10.1; no usar `latest`; plan de migración a 8 documentado | P1 |
| R-06 | ESM en NestJS 12 (paquetes `"type": "module"`) complica configuración y librerías | Media | Medio | Decidir ESM desde el inicio, tsconfig `NodeNext`, verificar librerías antes de adoptar | P1 |
| R-07 | Pooler de conexiones incompatible con Prisma (prepared statements) | Media | Medio | Desactivar prepared statements, usar `DIRECT_URL` para migraciones, prueba de humo | P1 |
| R-08 | Caché sirve publicaciones ocultas o de otra vertical | Baja | **Alto** | Clave de caché con vertical y estado; invalidación por evento; TTL ≤ 60 s | P2 |
| R-09 | Búsqueda en PostgreSQL no rinde con volumen | Media | Medio | Índices GIN/trigram, límites de consulta, medición con datos reales; motor externo solo con evidencia | P2 |
| R-10 | Archivos maliciosos o XSS vía imágenes | Baja | **Alto** | MIME real, recompresión, SVG prohibido, bucket separado, sin ejecución | P1 |
| R-11 | **Diferido a fase 2** (en el MVP no hay pasarela): webhooks de pago duplicados o fuera de orden corrompen suscripciones | Baja (MVP) | Medio | Al integrar Wompi/Mercado Pago: idempotencia por `providerEventId`, cálculo por fechas, conciliación diaria; el modelo deja espacio para `ProviderEvent` cuando se retome | P3 |
| R-12 | Suspensión del cómputo del plan Free de Neon (*scale-to-zero* a los 5 min) y ausencia de SLA/backups gestionados | Media | **Medio** | Reintento de conexión, `connect_timeout`, caché de catálogo, `/health/ready`; `pg_dump` semanal a R2; escalado a Launch al superar 800 MB u 85 CU-hours ([ADR-006](decisions/ADR-006-production-database-provider.md) §2.2) | P1 |

---

## 3. Riesgos de producto y comerciales

| ID | Riesgo | Prob. | Impacto | Mitigación | Prio |
|----|--------|:-----:|:-------:|-----------|:----:|
| R-13 | Los negocios no adoptan el panel y siguen publicando solo en redes | Alta | **Alto** | Onboarding asistido, carga masiva (**fase 2**), valor inmediato (leads), UX móvil simple | P1 |
| R-14 | Sin masa crítica de publicaciones el catálogo parece vacío | Alta | **Alto** | Lanzamiento por zona/categoría, acuerdos con negocios fundadores, curaduría inicial | P1 |
| R-15 | Disposición a pagar suscripción baja en el segmento | Media | **Alto** | Validar precio con entrevistas, plan gratuito limitado o trial, métricas de valor | P1 |
| R-16 | Competencia de marketplaces generales (Facebook, Mercado Libre) | Alta | Medio | Especialización por vertical, relación con el negocio, SEO local | P2 |
| R-17 | Spam y leads de baja calidad erosionan la confianza del negocio | Media | Medio | Rate limit, honeypot, calidad del formulario, marcado de spam | P2 |
| R-18 | Negocios publican artículos robados o falsificados | Media | **Alto** | Términos, denuncia, moderación, retención de evidencia, canal con autoridad | P2 |
| R-19 | Estacionalidad (temporadas) genera picos y caídas de uso | Media | Bajo | Plan de capacidad, caché, comunicación | P3 |
| R-20 | Costos de imágenes (storage/egress) crecen sin control | Media | Medio | Recompresión, límites por plan, R2 con egress gratuito | P2 |

---

## 4. Riesgos operativos

| ID | Riesgo | Prob. | Impacto | Mitigación | Prio |
|----|--------|:-----:|:-------:|-----------|:----:|
| R-21 | Una sola persona opera y mantiene la plataforma | Alta | **Alto** | Documentación, automatización de despliegue, runbooks, proveedores gestionados | P1 |
| R-22 | Moderación manual no escala | Media | Medio | Cola con prioridades, criterios escritos, futura automatización asistida | P2 |
| R-23 | Pérdida de datos por migración destructiva | Baja | **Alto** | Reglas de migración, respaldo previo, revisión por pares | P1 |
| R-24 | Correos transaccionales caen en spam | Media | Medio | Proveedor con dominio verificado (SPF/DKIM/DMARC), monitoreo de rebotes | P2 |
| R-25 | Falta de soporte en horario extendido | Media | Bajo | Canal único, FAQ, tiempos de respuesta publicados | P3 |
| R-32 | Error humano en la activación manual de suscripciones (fecha mal puesta, doble activación, cobro no registrado) | Alta | Medio | `Subscription.activatedByAdminId` + `activationNote` obligatorios, auditoría de cada activación, listado de suscripciones por vencer, conciliación mensual contra el extracto bancario/Nequi | P1 |

---

## 5. Riesgos de seguridad

| ID | Riesgo | Prob. | Impacto | Mitigación | Prio |
|----|--------|:-----:|:-------:|-----------|:----:|
| R-26 | Credential stuffing contra cuentas de negocios | Alta | **Alto** | Argon2id, rate limit, bloqueo progresivo, verificación de email, MFA opcional | P1 |
| R-27 | Escalada de privilegios en el panel de plataforma | Baja | **Alto** | Roles separados, MFA obligatorio (propuesta), auditoría, mínimo privilegio | P1 |
| R-28 | Robo de sesión por XSS | Baja | **Alto** | Escape de React, CSP, sin `dangerouslySetInnerHTML`, cookies HttpOnly | P1 |
| R-29 | Scraping masivo del catálogo | Alta | Medio | Rate limit, detección de patrones, términos de uso, no bloquear SEO legítimo | P2 |
| R-30 | Fuga de PII en logs o eventos | Media | **Alto** | Scrub de logs, eventos solo con IDs, revisión de plantillas | P1 |
| R-31 | Webhook falsificado que activa suscripciones | Baja | **Alto** | Firma HMAC, timestamp, verificación contra proveedor, alertas | P1 |

---

## 6. Riesgos legales y regulatorios (requieren validación profesional)

| ID | Riesgo | Prob. | Impacto | Validación requerida | Prio |
|----|--------|:-----:|:-------:|----------------------|:----:|
| L-01 | Incumplimiento de la Ley 1581 de 2012 y decretos reglamentarios | Media | **Alto** | Abogado especialista en protección de datos | P1 |
| L-02 | Calificación incorrecta como responsable vs encargado del tratamiento de leads | Media | **Alto** | Abogado; contrato de encargo con negocios | P1 |
| L-03 | Transferencia internacional de datos a proveedores cloud | Media | Medio | Abogado; verificar nivel adecuado y cláusulas | P2 |
| L-04 | Inscripción en RNBD no realizada cuando aplique | Media | Medio | Abogado/contador; evaluar umbrales | P2 |
| L-05 | Facturación electrónica y obligaciones tributarias de la suscripción | Media | **Alto** | Contador; definir quién factura y cómo | P1 |
| L-06 | Responsabilidad por artículos publicados (robados, falsificados) | Media | **Alto** | Abogado; términos, proceso de denuncia, cooperación con autoridades | P2 |
| L-07 | Tratamiento de datos de menores | Baja | **Alto** | Abogado; restricción de edad y verificación | P2 |
| L-08 | Cookies y consentimiento (analítica) | Media | Medio | Abogado; banner y registro de consentimiento si se usa analítica no esencial | P2 |
| L-09 | Publicidad y comunicaciones comerciales (autorización previa) | Media | Bajo | Abogado; opt-in explícito | P3 |
| L-10 | Términos y condiciones de la suscripción (renovación, cancelación, reembolsos) | Media | Medio | Abogado; redacción clara y aceptación registrada | P1 |

---

## 7. Supuestos explícitos

| ID | Supuesto | Si es falso |
|----|----------|-------------|
| S-01 | La primera vertical es Prenderías en Medellín y área metropolitana | Cambia la configuración inicial, no la arquitectura |
| S-02 | Los negocios tienen WhatsApp activo | El formulario de lead gana importancia; se evalúa otro canal |
| S-03 | El pago de artículos siempre ocurre fuera de la plataforma | Cambiaría el alcance del MVP y el modelo de riesgo |
| S-04 | El equipo es pequeño (1–3 desarrolladores) | La arquitectura ya lo asume; no se requiere cambio |
| S-05 | Volumen año 1: ~300 negocios, ~10.000 publicaciones activas | Ajustar índices, caché y plan de BD |
| S-06 | Un solo idioma (español Colombia) y una sola moneda (COP) | Añade i18n/multi-moneda al modelo |
| S-07 | Los negocios aceptan publicar manualmente, sin integración con POS | Requeriría importación/API (fase futura) |
| S-08 | No hay app móvil nativa en el MVP | Sin impacto si se mantiene la web responsive |
| S-09 | La moderación puede ser manual al inicio | Si el volumen crece, requiere automatización asistida |
| S-10 | El proveedor de pagos permite suscripciones recurrentes en Colombia | Si no, se replantea el cobro (manual/facturación) |

---

## 8. Decisiones de negocio y preguntas abiertas

### 8.1 Decisiones APROBADAS (C-10, 2026-11-12)

Estas decisiones **sustituyen** los supuestos anteriores del Prompt 01. Se aprobaron con un enfoque de MVP simple: menos piezas, menos integraciones, menos superficie de error.

| # | Decisión APROBADA | Consecuencias para el modelo y el Prompt 02 |
|---|-------------------|---------------------------------------------|
| Q-01 | El producto se llama **MarketCentral**. Cada negocio conserva su propio nombre comercial. Sin más discusión de branding. | Sin cambios en el modelo; nombre visible en la plataforma, no reemplaza la marca del negocio. |
| Q-06 | **Sin pasarela de pago en el MVP.** El cobro es manual: transferencia bancaria o Nequi; un administrador activa la suscripción desde el panel de Admin. Wompi / Mercado Pago se evalúan en fase 2. | **No se crean** `PaymentProviderAccount` ni `PaymentWebhookEvent`. Solo `Plan`, `Subscription` (con `status` y fechas), `Subscription.activatedByAdminId` y `Subscription.activationNote`. Sin webhooks de pago, sin conciliación automática, sin prorrateo. El módulo `Billing` queda reducido a registro de activaciones manuales. |
| Q-07 | **Sin moderación previa.** El dueño es responsable del contenido y de los artículos según los T&C. Una publicación pasa de `DRAFT` a `PUBLISHED` sin revisión. La moderación solo actúa **reactivamente** ante una denuncia. | `Business`: `APPROVED`, `SUSPENDED` (sin `PENDING_REVIEW`). `Listing`: `DRAFT`, `PUBLISHED`, `PAUSED`, `SOLD`, `ARCHIVED` (sin `PENDING_REVIEW` ni `REJECTED`). Sin cola de revisión previa, sin `SubmitForReview`. Se conserva `Report` + `ModerationCase` para denuncias y suspensiones. |
| Q-02 | Planes: **Free** 2 meses, 10 publicaciones activas, $0; **Base** 30 publicaciones, $30.000 COP/mes; **Pro** 50 publicaciones, $50.000 COP/mes. Todos con 1 usuario (el dueño) en el MVP, 5 imágenes por publicación y acceso al panel de leads. Valores sujetos a validación comercial durante el piloto. | Se modelan `Plan` + `PlanEntitlement` (clave/valor) para que los límites sean configurables sin migración. La suscripción del dueño es la única membresía del MVP; el modelo de `Membership` se conserva para fases posteriores. |
| Q-03 | Límite de publicaciones activas por plan: 10 / 30 / 50. | Se aplica en backend con `EntitlementReader`; nunca en el frontend. |
| Q-15 | **COP fijo.** `priceCurrency varchar(3) DEFAULT 'COP'` con `CHECK (price_currency = 'COP')`. Sin multi-moneda. | Sin tabla de monedas ni tasas; el precio se guarda en enteros (unidades menores) y se formatea en `es-CO`. |
| Q-16 | `Business.city` **obligatorio** (dropdown de municipios del Valle de Aburrá: Medellín, Bello, Itagüí, Envigado, Sabaneta, La Estrella, Caldas, Copacabana, Girardota, Barbosa) + `addressLine` opcional (texto libre). `Listing` hereda la ubicación del negocio. Índice `idx_business_city` sobre `(city) WHERE deleted_at IS NULL`. Sin coordenadas ni PostGIS. El catálogo público filtra por `city`. | El municipio es un catálogo controlado (no texto libre); se valida contra la lista. `addressLine` no se indexa ni se muestra completo en el catálogo público. |
| Q-13 | Qué combinaciones de filtros se indexan. | **No bloquea el Prompt 02**: se decide en la épica de PublicCatalog del Prompt 04, con consultas reales. |
| L-01 / L-02 | Validación legal: no se requiere abogado dedicado para el MVP. Se publican Política de Privacidad y Términos y Condiciones con plantilla estándar que incluyen: (a) el negocio es responsable del contenido y veracidad de sus artículos; (b) el negocio es responsable del tratamiento de datos de los compradores que lo contactan; (c) la plataforma es solo canal de visibilidad y contacto y no participa en la compraventa; (d) el comprador acepta el consentimiento de datos al enviar el formulario. Sin inscripción en RNBD. Facturación electrónica con proveedor estándar cuando haya cobros activos. | El Prompt 02 debe incluir los campos de consentimiento (`acceptedTermsAt`, `privacyPolicyVersion`, consentimiento del lead) y la retención mínima documentada. Queda como **nota de revisión futura** si cambia el volumen o el modelo de cobro. |

### 8.2 Preguntas que permanecen abiertas (ninguna bloquea el Prompt 02)

| # | Pregunta | Supuesto vigente | Impacto si cambia | Prio | Decide |
|---|----------|------------------|-------------------|:----:|--------|
| Q-04 | ¿Trial gratuito separado? | No: el plan **Free de 2 meses** cumple ese papel | Flujo de suscripción y fraude | P3 | Humano |
| Q-05 | ¿Proveedor de PostgreSQL en producción? | **RESUELTA** (2026-11-12): Neon Free, `aws-sa-east-1`, escalado a Launch — [ADR-006](decisions/ADR-006-production-database-provider.md) | Queda por verificar la versión exacta de PG al crear el proyecto | ~~P1~~ | Humano |
| Q-08 | ¿Se aceptan leads para negocios sin suscripción vigente? | Rechazar (`LISTING_NOT_CONTACTABLE`) | Regla de Leads y mensajes | P2 | Humano |
| Q-09 | ¿Periodo de gracia tras vencimiento de suscripción? | 7 días de solo lectura antes de ocultar | Visibilidad y continuidad | P2 | Humano |
| Q-10 | ¿Quién puede ver los leads? | OWNER/ADMIN/EDITOR; en el MVP solo el dueño | Privacidad y roles | P2 | Humano |
| Q-11 | ¿Se mide el clic de WhatsApp? | No en MVP; si se mide, evento anónimo separado | Analítica y consentimiento | P3 | Humano |
| Q-12 | ¿Verificación de negocios (RUT, cámara de comercio)? | Manual y opcional al aprobar | Confianza y carga operativa | P2 | Humano |
| Q-14 | ¿Historial de precios visible? | No en MVP | Modelo de datos | P3 | Humano |
| Q-17 | ¿Correo de confirmación al comprador tras enviar lead? | No | Privacidad y UX | P3 | Humano |
| Q-18 | ¿Se permite HTML en descripciones? | No; texto plano | XSS y sanitización | P2 | Humano |
| Q-19 | ¿Denuncias de publicaciones en MVP? | Sí, formulario simple (moderación reactiva) | Módulo Moderation | P2 | Humano |
| Q-20 | ¿Analítica de producto (PostHog/GA)? | PENDIENTE | Cookies, consentimiento, costos | P3 | Humano |
| Q-21 | ¿Correo transaccional (Resend/SES/Postmark)? | PENDIENTE | Entregabilidad, costos | P2 | Humano |
| Q-22 | ¿Antivirus de archivos en MVP? | No; riesgo aceptado (validación de MIME real y recompresión) | Seguridad y costo | P2 | Humano |
| D-01 | ¿UUID v7 en aplicación o con `uuidv7()` de PostgreSQL 18? | **RESUELTA** (C-11.1): `DEFAULT uuidv7()` en la columna; alternativa `@default(uuid(7))` si el tooling lo exige | — | ~~P2~~ | Humano |

**Regla:** ninguna pregunta de §8.2 bloquea el Prompt 02 ni el Prompt 03. Todas tienen supuesto escrito y se resuelven en la fase que las necesita.

---

## 9. Precondiciones del Prompt 02: ninguna bloqueante

Con C-10 no queda ninguna decisión de negocio pendiente que impida diseñar el modelo entidad-relación, el diccionario de datos, las restricciones, los índices y `schema.prisma`. El Prompt 02 puede partir de estos **supuestos firmados**:

| Tema | Supuesto firmado para el Prompt 02 | Origen |
|------|-----------------------------------|--------|
| Proveedor de BD | PostgreSQL 18.x en Neon Free (`aws-sa-east-1`); extensión `pg_trgm`; `uuidv7()` disponible | [ADR-006](decisions/ADR-006-production-database-provider.md) |
| Identificadores | UUID v7 con `DEFAULT uuidv7()` (PG 18); alternativa `@default(uuid(7))` (C-11.1) | [10 §3](10-data-and-persistence-strategy.md) |
| Dinero | Enteros en **pesos** COP (`price_amount`) + `priceCurrency` fijo `'COP'` con `CHECK` | Q-15 (C-10), C-03 (C-11) |
| Cobro | Manual; sin pasarela, sin webhooks de pago, sin `PaymentProviderAccount`/`PaymentWebhookEvent` | Q-06 (C-10) |
| Planes | `Plan` + `PlanEntitlement` (clave/valor): Free 10 / Base 30 / Pro 50 publicaciones activas | Q-02, Q-03 (C-10) |
| Moderación | Sin revisión previa; `Business` `APPROVED`/`SUSPENDED`; `Listing` `DRAFT`/`PUBLISHED`/`PAUSED`/`SOLD`/`ARCHIVED`; denuncias reactivas | Q-07 (C-10) |
| Ubicación | `Business.city` obligatorio desde catálogo de 10 municipios + `addressLine` opcional; `Listing` hereda; índice `idx_business_city` | Q-16 (C-10) |
| Miembros | 1 usuario (dueño) en el MVP; el modelo de `Membership` se conserva para fases posteriores | Q-02 (C-10) |
| Cumplimiento | Campos de consentimiento y versiones de T&C/Política; sin RNBD; sin facturación electrónica en el MVP | L-01/L-02 (C-10) |

**Pendientes que NO bloquean el Prompt 02** (deben resolverse antes de producción, no antes del modelo): región de hosting de `api`/`web`, versión exacta de PostgreSQL que asigne Neon, proveedor de correo transaccional (Q-21), analítica (Q-20), antivirus (Q-22) y revisión legal de la transferencia internacional de datos a Brasil (L-03).

---

## 10. Matriz de calor (resumen)

| Impacto ↓ / Prob. → | Baja | Media | Alta |
|---------------------|------|-------|------|
| **Alto** | R-08, R-10, R-27, R-28, R-31 | R-01, R-03, R-11, R-12, R-21, R-26, R-30, L-01, L-02, L-05 | R-13, R-14, R-15, L-06 |
| **Medio** | R-25 | R-02, R-04, R-06, R-07, R-09, R-17, R-18, R-20, R-22, R-24, R-29, L-03, L-04, L-08, L-10 | R-05, R-16, R-32, L-09 |
| **Bajo** | — | R-19, R-11 | — |

**Lectura:** con C-10 los riesgos P1 ya no incluyen pasarelas de pago: se concentran en aislamiento multi-tenant, visibilidad del catálogo, credenciales, respaldo de datos y **activación manual de suscripciones** (R-32). Esos son los que deben tener pruebas automatizadas y control humano registrado antes de construir.
