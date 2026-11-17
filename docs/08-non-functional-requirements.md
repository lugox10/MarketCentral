# 08 — Requisitos no funcionales

**Estado:** documento para revisión · **Fecha:** 2026-11-12 · **Fase:** planificación (Prompt 01)

> Los umbrales marcados **PROPUESTA** son valores iniciales sin datos de producción: se fijan para poder verificar, y se revisarán con métricas reales. Los marcados **PENDIENTE** requieren decisión humana.

---

## 1. Rendimiento

| ID | Requisito | Objetivo | Verificación |
|----|-----------|----------|--------------|
| NFR-P-01 | LCP en páginas públicas (móvil, p75) | ≤ 2,5 s | Lighthouse CI / CrUX |
| NFR-P-02 | INP en páginas públicas (p75) | ≤ 200 ms | RUM |
| NFR-P-03 | CLS en páginas públicas (p75) | ≤ 0,1 | Lighthouse CI |
| NFR-P-04 | TTFB del catálogo (p95, servidor) | ≤ 500 ms | Métricas de API |
| NFR-P-05 | `GET /public/listings` (p95) | ≤ 300 ms con 10k publicaciones activas | Prueba de carga |
| NFR-P-06 | `GET /public/listings/:slug` (p95) | ≤ 200 ms | Prueba de carga |
| NFR-P-07 | Acciones del panel (p95) | ≤ 400 ms | Prueba de carga |
| NFR-P-08 | Carga de imagen percibida | Placeholder < 100 ms; imagen completa < 1,5 s en 4G | Medición en dispositivo |
| NFR-P-09 | Peso inicial de JS en páginas públicas | ≤ 180 KB gzip (**PROPUESTA**) | Bundle analyzer |
| NFR-P-10 | Consultas por render de catálogo | ≤ 5 consultas SQL | Instrumentación ORM |

**Presupuesto de rendimiento:** si una página pública supera 2 de estos objetivos durante 7 días, se prioriza su corrección sobre nuevas funcionalidades.

---

## 2. SEO

| ID | Requisito |
|----|-----------|
| NFR-S-01 | URLs legibles y estables: `/v/{verticalSlug}`, `/v/{verticalSlug}/{categorySlug}`, `/p/{listingSlug}`, `/n/{businessSlug}`. |
| NFR-S-02 | Renderizado en servidor del contenido principal (título, precio, imágenes, negocio) sin depender de JS. |
| NFR-S-03 | `<title>` y `meta description` únicos y derivados de datos reales. |
| NFR-S-04 | `canonical` en todas las páginas de listado y detalle; variantes con filtros no generan canónicas competidoras. |
| NFR-S-05 | `robots.txt` y `sitemap.xml` por vertical, generados con publicaciones visibles; actualización ≤ 24 h. |
| NFR-S-06 | Datos estructurados JSON-LD: `Product`/`Offer` en detalle, `BreadcrumbList` en navegación, `Organization` del negocio cuando aplique. |
| NFR-S-07 | Open Graph y Twitter Card con imagen principal. |
| NFR-S-08 | Páginas con 0 resultados devuelven `200` con contenido útil (no `404`); publicaciones no visibles devuelven `404`/`410` según corresponda. |
| NFR-S-09 | Sin contenido duplicado entre verticales; una publicación pertenece a una sola vertical. |
| NFR-S-10 | Redirecciones 301 al cambiar slug de publicación o negocio (historial de slugs). |

**PENDIENTE:** política de indexación de páginas con filtros (permitir solo combinaciones canónicas definidas) — Q-13.

---

## 3. Accesibilidad

Objetivo: **WCAG 2.2 nivel AA** en flujos críticos (exploración, detalle, contacto, login, panel).

| ID | Requisito |
|----|-----------|
| NFR-A-01 | Navegación completa por teclado; orden de foco lógico; sin trampas de foco. |
| NFR-A-02 | Indicador de foco visible con contraste ≥ 3:1. |
| NFR-A-03 | Contraste de texto ≥ 4,5:1 (normal) y ≥ 3:1 (grande). |
| NFR-A-04 | Etiquetas programáticas en todos los campos; errores asociados al campo con `aria-describedby`. |
| NFR-A-05 | Imágenes con `alt` significativo; decorativas con `alt=""`. |
| NFR-A-06 | Formularios con mensajes de error textuales, no solo color. |
| NFR-A-07 | Zoom hasta 200 % sin pérdida de contenido; reflow a 320 px. |
| NFR-A-08 | Sin parpadeos > 3 veces/s; respeto de `prefers-reduced-motion`. |
| NFR-A-09 | Landmarks y jerarquía de encabezados correcta (un `h1` por página). |
| NFR-A-10 | Verificación automatizada (axe) en CI + revisión manual de flujos clave por release. |

---

## 4. Responsive y compatibilidad

| ID | Requisito |
|----|-----------|
| NFR-R-01 | Diseño funcional en 320 px, 768 px, 1024 px, 1440 px. |
| NFR-R-02 | Áreas táctiles ≥ 44×44 px en móvil. |
| NFR-R-03 | Navegadores: últimas 2 versiones de Chrome, Edge, Firefox, Safari; Safari iOS 16.4+. |
| NFR-R-04 | Sin scroll horizontal no intencional en ningún breakpoint. |
| NFR-R-05 | Formularios largos (publicación) utilizables en móvil: pasos, guardado de borrador. |

---

## 5. Paginación y límites de consulta

| ID | Requisito |
|----|-----------|
| NFR-Q-01 | Paginación por **cursor (keyset)**, no `OFFSET`, en catálogo y listados de panel. |
| NFR-Q-02 | Tamaño de página por defecto 24; máximo 48 (**PROPUESTA**). |
| NFR-Q-03 | Máximo de filtros por consulta: 8; máximo de valores por filtro: 20. |
| NFR-Q-04 | Facets limitados a los 20 valores más frecuentes por atributo (**PROPUESTA**). |
| NFR-Q-05 | Profundidad máxima de paginación: 200 páginas; más allá, se pide refinar filtros. |
| NFR-Q-06 | Timeout de consulta de catálogo: 3 s; se devuelve error controlado. |
| NFR-Q-07 | Exportaciones del panel limitadas a 5.000 filas y generadas asíncronamente (**PENDIENTE** si aplica en MVP). |

---

## 6. Índices y búsqueda en PostgreSQL

Sin motor de búsqueda externo en el MVP. Estrategia (**PROPUESTA**, se detalla en el Prompt 02):

| Necesidad | Estrategia |
|-----------|------------|
| Listado por vertical + estado + fecha | Índice compuesto `(verticalId, status, publishedAt DESC)` parcial `WHERE status = 'PUBLISHED'` |
| Filtro por categoría | Índice compuesto con `categoryId` antepuesto |
| Filtro por negocio | Índice `(businessId, status)` |
| Rango de precio | Índice `(verticalId, priceAmount)` parcial por estado visible |
| Búsqueda de texto | `tsvector` generado sobre título + descripción con `pg_trgm` para tolerancia a errores; índice GIN |
| Filtro por atributos | GIN sobre `jsonb` de atributos (`jsonb_path_ops`) + índices de expresión para atributos muy usados |
| Slug | Índice único por vertical |
| Ubicación | Índice por `municipalityCode`/`neighborhoodCode`; geolocalización fuera del MVP |

**Regla:** un índice solo se crea con una consulta real que lo justifique y se valida con `EXPLAIN ANALYZE` sobre datos representativos.

**Extensiones permitidas (proveedor: Neon Free, [ADR-006](decisions/ADR-006-production-database-provider.md)):** `pg_trgm` para búsqueda tolerante a errores y `uuidv7()` nativo de PostgreSQL 18 (`https://www.postgresql.org/docs/18/functions-uuid.html`). `pgcrypto` solo si se requiere hashing en base de datos (**verificar disponibilidad en la consola antes de usarla**). Prohibidas: extensiones propietarias del proveedor, `pgvector`/PostGIS y cualquier motor de búsqueda externo mientras no exista una necesidad medida (ver NFR-P y [11 §5](11-public-marketplace-experience.md)).

---

## 7. Caché

| ID | Requisito |
|----|-----------|
| NFR-C-01 | Se permite caché de páginas públicas y respuestas de catálogo con TTL ≤ 60 s. |
| NFR-C-02 | Invalidación por evento (`ListingPublished`, `ListingSold`, `BusinessSuspended`, `SubscriptionExpired`). |
| NFR-C-03 | Nunca se cachea contenido autenticado ni respuestas de panel en cachés compartidas. |
| NFR-C-04 | La caché no puede servir una publicación no visible: la clave incluye vertical y la invalidación es obligatoria en cambios de visibilidad. |
| NFR-C-05 | Si la caché falla, el sistema responde desde la base de datos (degradación, no error). |
| NFR-C-06 | Entitlements y límites de plan cacheados ≤ 30 s con invalidación por evento. |

---

## 8. Observabilidad

| ID | Requisito |
|----|-----------|
| NFR-O-01 | Logs estructurados JSON con `timestamp`, `level`, `service`, `requestId`, `actorId` (si aplica), `route`, `status`, `durationMs`. |
| NFR-O-02 | `requestId` propagado web → api → worker; en webhooks, el id del proveedor. |
| NFR-O-03 | Sin PII ni secretos en logs; scrub de email, teléfono y tokens. |
| NFR-O-04 | Métricas RED por endpoint (rate, errors, duration) y métricas de negocio: publicaciones publicadas, leads creados, suscripciones activas. |
| NFR-O-05 | Trazas distribuidas en flujos críticos (publicar, lead, webhook) cuando el proveedor lo permita. |
| NFR-O-06 | Alertas: error rate > 2 % durante 5 min; p95 > 2× objetivo durante 10 min; cola de outbox con retraso > 5 min; fallo de job de expiración. |
| NFR-O-07 | Dashboard mínimo: disponibilidad, latencia, errores, leads/día, publicaciones activas, suscripciones por estado. |
| NFR-O-08 | Retención de logs: 30 días calientes, 12 meses en almacenamiento frío (**PROPUESTA**). |

---

## 9. Disponibilidad y tolerancia a fallos

| ID | Requisito |
|----|-----------|
| NFR-D-01 | Disponibilidad objetivo del catálogo: 99,5 % mensual (**PROPUESTA**). |
| NFR-D-02 | Disponibilidad del panel: 99,0 % mensual (**PROPUESTA**). |
| NFR-D-03 | Caída de correo, storage o pagos no impide navegar el catálogo ni gestionar publicaciones ya existentes. |
| NFR-D-04 | Caída de la base de datos: página de mantenimiento con `503` y `Retry-After`; sin datos de otro tenant. |
| NFR-D-05 | Healthchecks `/health` (liveness) y `/health/ready` (dependencias) para el orquestador. |
| NFR-D-06 | Despliegues sin downtime para web; api con al menos 2 instancias en producción (**PENDIENTE** según proveedor). |
| NFR-D-07 | Reintentos con backoff exponencial y jitter en llamadas salientes; circuit breaker en proveedores externos. |

---

## 10. Respaldos y recuperación

| ID | Requisito |
|----|-----------|
| NFR-B-01 | RPO ≤ 7 días para desastre total (respaldo lógico semanal `pg_dump` → R2) y RPO ≤ 6 h para error reciente (*instant restore* de Neon). **PROPUESTA** derivada de [ADR-006](decisions/ADR-006-production-database-provider.md) §2.5; el plan Free **no** incluye backups diarios gestionados. |
| NFR-B-02 | RTO ≤ 4 h para restaurar servicio (**PROPUESTA**). |
| NFR-B-03 | Restauración probada al menos una vez antes del lanzamiento y luego trimestralmente, con acta. |
| NFR-B-04 | Los backups no incluyen objetos de storage: los medios requieren estrategia propia (versionado o copia) — **PENDIENTE**. |
| NFR-B-05 | Backup de configuración y secretos documentado y cifrado, separado de la base de datos. |
| NFR-B-06 | Borrado de proyecto/base de datos en el proveedor exige confirmación y respaldo previo. |
| NFR-B-07 | El respaldo lógico semanal se ejecuta en el `worker`, se cifra en reposo y se verifica restaurándolo en un proyecto de Neon de staging al menos una vez por trimestre. |

---

## 11. Mantenibilidad

| ID | Requisito |
|----|-----------|
| NFR-M-01 | TypeScript `strict`; sin `any` implícito; lint y formato en CI. |
| NFR-M-02 | Fronteras de módulos verificadas (regla de dependencias); sin imports profundos entre módulos. |
| NFR-M-03 | Cobertura mínima de pruebas: dominio y aplicación ≥ 80 %; global ≥ 60 % (**PROPUESTA**). |
| NFR-M-04 | Contrato OpenAPI versionado y generación del cliente tipado en CI; el build falla si el contrato cambia sin regenerar. |
| NFR-M-05 | Migraciones revisadas por una segunda persona; nunca editadas después de aplicadas en producción. |
| NFR-M-06 | ADR para toda decisión que cambie límites, dependencias o contratos. |
| NFR-M-07 | Tiempo de onboarding documentado: un desarrollador nuevo levanta el entorno local en < 1 día. |

---

## 12. Pruebas (resumen; detalle en [05](05-modules-and-responsibilities.md) por módulo)

| Nivel | Alcance | Herramienta |
|-------|---------|-------------|
| Unitarias | Dominio y casos de uso con dobles de puertos | Jest |
| Integración | Repositorios Prisma contra PostgreSQL real (contenedor), contratos de puertos | Jest + Supertest |
| E2E | Flujos completos web+api en navegador | Playwright |
| Seguridad | Pruebas negativas N-01…N-15, webhooks, archivos | Jest + Supertest |
| Carga | Catálogo y detalle con volumen representativo | k6 (PENDIENTE de herramienta) o Playwright + Artillery |
| Accesibilidad | axe en CI + revisión manual | axe-core / Playwright |

**Puertas de calidad:** ningún PR mergea con pruebas rojas, con cobertura en descenso injustificado, o con cambios de contrato sin regeneración del cliente.

---

## 13. Requisitos de datos y privacidad

| ID | Requisito |
|----|-----------|
| NFR-DP-01 | Datos personales minimizados; sin campos "por si acaso". |
| NFR-DP-02 | Retención y borrado según [07 §10](07-security-and-multitenancy.md). |
| NFR-DP-03 | Exportación de datos del negocio bajo solicitud (contactos, publicaciones) — **PENDIENTE** de formato y plazo. |
| NFR-DP-04 | Borrado de cuenta con anonimización de datos históricos requeridos por ley. |
| NFR-DP-05 | Cifrado en tránsito obligatorio; en reposo según proveedor. |

---

## 14. Costos y operación (restricción de diseño)

| ID | Requisito |
|----|-----------|
| NFR-K-01 | El MVP debe operar con costo de infraestructura mensual ≤ 100 USD (**PROPUESTA**), excluyendo dominio y correo transaccional. |
| NFR-K-02 | Ningún componente debe exigir un plan empresarial para funcionar (p. ej. PITR, SSO) en el MVP. |
| NFR-K-03 | El catálogo público no puede depender de un plan que **pause el proyecto completo** por inactividad. La suspensión del **cómputo** (Neon Free, 5 min) es aceptable solo con las mitigaciones de [ADR-006 §2.4](decisions/ADR-006-production-database-provider.md): `connect_timeout`, reintento único, `/health/ready` y caché ≤60 s. |
| NFR-K-04 | El almacenamiento de imágenes debe tener egress predecible; se prefiere egress gratuito (R2) o CDN con costo acotado. |
