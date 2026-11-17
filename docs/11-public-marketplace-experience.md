# 11 — Experiencia del marketplace público

**Estado:** documento para revisión · **Fecha:** 2026-11-12 · **Fase:** planificación (Prompt 01)

> **Principio rector:** el catálogo público **consulta las publicaciones existentes**. No copia, no replica ni duplica inventario. Cada tarjeta y cada detalle se derivan en el momento (o desde caché de corta vida) de la publicación que administra el negocio.

---

## 1. Objetivos de experiencia

1. Que un comprador encuentre un artículo relevante en **≤ 3 pasos** desde la portada.
2. Que entienda **de qué negocio** es cada artículo y cómo contactarlo sin ambigüedad.
3. Que la página sea indexable, rápida y usable en un celular de gama media con red 4G.
4. Que el negocio reciba contacto de calidad (lead con contexto o WhatsApp directo).

**No objetivos del MVP:** compra en línea, carrito, favoritos sincronizados, comparador, mensajería interna, reseñas verificadas, recomendaciones personalizadas.

---

## 2. Mapa de rutas públicas

| Ruta | Contenido | Render | Indexable |
|------|-----------|--------|-----------|
| `/` | Portada: verticales activas + publicaciones destacadas/recientes | SSR + caché 60 s | Sí |
| `/v/[vertical]` | Landing de vertical: categorías, filtros rápidos, publicaciones recientes | SSR + caché 60 s | Sí |
| `/v/[vertical]/c/[categoria]` | Listado por categoría (incluye subcategorías) | SSR + caché 60 s | Sí |
| `/v/[vertical]/buscar?q=...` | Resultados de búsqueda | SSR (no cacheado si hay `q`) | No (noindex) |
| `/p/[slug]` | Detalle de publicación | SSR + caché 60 s | Sí |
| `/n/[slug]` | Perfil público del negocio + sus publicaciones activas | SSR + caché 60 s | Sí |
| `/contacto`, `/terminos`, `/privacidad`, `/ayuda` | Páginas legales e informativas | Estáticas | Sí |
| `/sitemap.xml`, `/sitemap-[vertical].xml` | Sitemaps | Generados | — |
| `/robots.txt` | Reglas | Estático | — |

**Slugs:** `[vertical]` y `[categoria]` son slugs estables; `[slug]` de publicación incluye un identificador corto para evitar colisiones y permitir renombrado con redirección (`/p/reloj-casio-vintage-a1b2c3`).

---

## 3. Portada

**Bloques, en orden móvil:**

1. **Header** con logo, selector de vertical (si hay más de una), buscador y enlace "Soy negocio".
2. **Hero** con propuesta de valor y buscador grande (input + botón).
3. **Verticales activas** como tarjetas (por ahora: Prenderías).
4. **Categorías destacadas** de la vertical principal.
5. **Publicaciones recientes** (grid de 12, con "Ver más").
6. **Negocios destacados** (opcional, selección editorial — **PENDIENTE** de criterio).
7. **Bloque de confianza**: cómo funciona, que el pago se acuerda con el negocio, que el contacto es directo.
8. **Footer** con legales, contacto y enlaces.

**Regla:** la portada no muestra publicaciones no visibles; si no hay contenido, muestra estado vacío con llamada a explorar categorías y no un bloque roto.

---

## 4. Navegación por vertical

- Selector de vertical visible en header cuando existan ≥ 2 verticales activas.
- Breadcrumb: `Inicio / Prenderías / Ropa / Chaquetas`.
- La vertical define: categorías, filtros disponibles, orden por defecto y textos.
- Una URL de vertical inactiva responde `404` con enlace a las activas.
- Las categorías se muestran con conteo de publicaciones visibles (si el conteo es 0, se muestran igualmente para SEO, salvo que la categoría esté desactivada).

---

## 5. Catálogo agregado

### 5.1 Tarjeta de publicación

| Elemento | Regla |
|----------|-------|
| Imagen principal | Primera `READY`; `alt` = título; `loading="lazy"` salvo las 4 primeras; relación 4:3 |
| Título | Máximo 2 líneas con truncado visual |
| Precio | Formateado en COP; si es "a convenir", texto explícito |
| Condición | Etiqueta corta (`Nuevo`, `Como nuevo`, `Usado`) |
| Negocio | Nombre + municipio/zona |
| Estado | Sin badge de estado interno; "Vendido" no aparece en catálogo (se excluye) |
| Acción | Toda la tarjeta es enlace al detalle (sin botones anidados) |

### 5.2 Reglas de visibilidad (resumen de R-01)

Una publicación aparece si y solo si:

1. `listing.status = PUBLISHED`
2. `business.status = APPROVED` (no `SUSPENDED`)
3. `business_vertical.enabled = true` y `vertical.status = ACTIVE`
4. `category.status = ACTIVE`
5. Suscripción del negocio en `TRIALING` o `ACTIVE` (la prueba del plan Free cuenta); **no** `SUSPENDED`, `EXPIRED` ni `CANCELLED` (Q-06, C-10, C-11.2; Q-09 sigue abierta solo para el caso "lead a negocio sin suscripción")
6. No archivada por una decisión de moderación vigente (moderación **reactiva**, Q-07)

La regla se implementa **una sola vez** (`VisibilityPolicy`) y la consumen catálogo, detalle y perfil. No existe revisión previa: una publicación `PUBLISHED` es visible en el mismo instante en que se publica si cumple 2–5.

### 5.3 Paginación

- Keyset sobre `(publishedAt, id)`.
- "Cargar más" en móvil; paginación numerada accesible en escritorio si se desea (misma consulta).
- La URL conserva filtros; el scroll infinito puro se evita por SEO y accesibilidad.
- Página 1 indexable; páginas profundas con `noindex, follow` para evitar index bloat (**PROPUESTA**).

---

## 6. Búsqueda

- Campo único en header y en portada de vertical.
- Búsqueda sobre título y descripción con `tsvector` (español) y tolerancia a errores con `pg_trgm`.
- Normalización: minúsculas, sin acentos, sin signos; se preservan números y tallas (`talla 38`, `iPhone 13`).
- Sinónimos por vertical configurables (**FASE FUTURA**): `chaqueta` ↔ `campera`, `zapatos` ↔ `calzado`.
- Resultados con término resaltado solo si el escape es seguro (React escapa por defecto).
- Si no hay resultados: sugerencias (categorías populares, quitar filtros) y publicaciones similares de la misma categoría.
- La búsqueda **no** expone publicaciones no visibles ni negocios suspendidos.

**Relevancia (PROPUESTA):** `score = ts_rank(titulo, query) * 2 + ts_rank(descripcion, query) + recency_boost`; desempate por `publishedAt DESC, id DESC`. Se documentará la fórmula final en el Prompt 02 con datos reales.

---

## 7. Filtros y ordenamiento

### 7.1 Filtros disponibles (por definición de vertical)

| Filtro | Tipo | Aplica a |
|--------|------|----------|
| Categoría / subcategoría | Árbol | Todas |
| Precio | Rango | Todas |
| Condición | Selección | Prenderías (configurable) |
| Ubicación (municipio/zona) | Selección | Todas |
| Atributos de la categoría | Según `AttributeDefinition.filterable` | Variables |
| Negocio | Enlace | Desde perfil |
| Texto | Búsqueda | Todas |

**Ejemplo Prenderías (configuración, no código):** talla, marca, color, género, material, estado de conservación.

### 7.2 Reglas

- Los filtros se derivan de la configuración; el frontend **no** tiene listas hardcodeadas.
- Un filtro con 0 resultados se muestra deshabilitado con conteo 0 (o se oculta — **PENDIENTE** de UX).
- Selección múltiple dentro del mismo atributo = OR; entre atributos = AND.
- Los filtros activos se muestran como chips removibles y se reflejan en la URL.
- Límites: 8 filtros activos, 20 valores por filtro (NFR-Q-03/04).
- Filtros inválidos o desconocidos → `400` en API; la UI los descarta y muestra aviso.

### 7.3 Ordenamiento

| Opción | Criterio |
|--------|----------|
| Relevancia (default con texto) | Score de búsqueda |
| Más recientes (default sin texto) | `publishedAt DESC` |
| Menor precio | `priceAmount ASC` |
| Mayor precio | `priceAmount DESC` |

Sin orden por "destacados" pagado en MVP (evita conflictos con transparencia).

---

## 8. Detalle de publicación

**Estructura:**

1. Galería (máx. 10 imágenes, miniaturas, swipe en móvil, sin zoom avanzado en MVP).
2. Título, precio, condición, ubicación.
3. Descripción (texto plano con saltos de línea; sin HTML).
4. Atributos relevantes en tabla de definición–valor.
5. **Bloque de negocio:** nombre, logo/avatar, municipio, "Ver perfil", otras publicaciones activas (máx. 4).
6. **Acciones de contacto:** botón primario "Escribir al negocio" (formulario) y secundario "WhatsApp".
7. Aviso: "El pago y la entrega se acuerdan directamente con el negocio. MarketCentral no procesa el pago."
8. Publicaciones relacionadas (misma categoría, misma vertical; máx. 8).
9. Reportar publicación (enlace discreto → formulario de denuncia).

**Reglas:**

- Si la publicación no es visible → `404` (o `410` si estuvo publicada y fue archivada, con enlace a la vertical).
- El detalle **no** muestra datos del negocio que no sean públicos (sin email personal, sin documentos).
- El teléfono se muestra solo como enlace de WhatsApp; no en texto plano copiable para reducir scraping (**PROPUESTA**).
- Los enlaces de WhatsApp se generan en servidor con mensaje prellenado: "Hola, vi tu publicación «{título}» en MarketCentral. ¿Está disponible?"
- La navegación desde un resultado de búsqueda conserva el contexto de retorno ("Volver a resultados").
- JSON-LD `Product` + `Offer` con precio, moneda y disponibilidad; sin datos inventados.

---

## 9. Perfil público del negocio

| Elemento | Regla |
|----------|-------|
| Nombre y descripción | Del perfil público del negocio |
| Ubicación | Municipio/zona; dirección exacta solo si el negocio la publica |
| Logo/avatar | Imagen procesada |
| Verticales activas | Chips |
| Publicaciones activas | Grid paginado, solo visibles |
| Contacto | Formulario y WhatsApp (si están configurados) |
| Desde | Fecha de alta (mes/año), no fecha exacta |
| Métricas | No se muestran conteos de leads ni ventas |

**Reglas:** negocio suspendido → perfil `404`; negocio cerrado → `410` con mensaje; sin publicaciones activas → perfil visible con estado vacío (si el negocio sigue aprobado) para no romper enlaces.

---

## 10. Contacto

### 10.1 Formulario (crea Lead)

- Campos: nombre, email **o** teléfono (al menos uno), mensaje (máx. 1000 caracteres), consentimiento obligatorio.
- Contexto precargado: publicación y negocio (no editables por el usuario).
- Validación en cliente para UX y en servidor como fuente de verdad.
- Estados: enviando, éxito ("El negocio recibirá tu mensaje"), error con reintento.
- Antiabuso: rate limit, honeypot invisible, tiempo mínimo de llenado (**PROPUESTA**).
- Confirmación por correo al comprador **opcional** (**PENDIENTE**, Q-17).

### 10.2 WhatsApp (contacto externo)

- Botón visible con icono y texto "WhatsApp".
- Abre `https://wa.me/<numero>?text=<mensaje>` en nueva pestaña.
- **No crea Lead**, no registra conversación, no cambia estados. **[APROBADA]**
- Si el negocio no configuró WhatsApp, el botón no se muestra (no se inventa número).
- El clic puede medirse con evento analítico anónimo si se aprueba (Q-11).

### 10.3 Jerarquía de contacto

El formulario es la acción **primaria** (genera trazabilidad para el negocio); WhatsApp es **secundaria** (inmediatez). Esta jerarquía es una decisión de producto **PROPUESTA** y reversible.

---

## 11. Estados de interfaz

| Estado | Comportamiento |
|--------|----------------|
| Cargando | Skeletons con la misma geometría que la tarjeta; sin saltos de layout |
| Vacío (sin resultados) | Mensaje claro + sugerencias + quitar filtros |
| Vacío (vertical sin publicaciones) | Mensaje + CTA "Soy negocio" |
| Error de red | Mensaje con reintento; conserva filtros |
| Error de servidor | Página de error con `requestId` visible para soporte |
| Imagen rota | Placeholder con `alt` del título |
| Publicación no disponible | `404` con enlaces a la categoría y a la vertical |

---

## 12. SEO y metadatos

- `title`: `{Categoría} en {Municipio} | Prenderías | MarketCentral` (patrón configurable).
- `description`: primeras 155 caracteres de la descripción o texto generado por plantilla.
- `canonical` autorreferente; filtros no generan canónicas nuevas salvo combinaciones aprobadas.
- `hreflang` no aplica (un solo idioma: español Colombia) — **PENDIENTE** si se internacionaliza.
- Sitemap dividido por vertical; `lastmod` de la publicación.
- Imágenes con `og:image` de 1200×630 generada o derivada.
- Sin `noindex` en páginas con contenido; `noindex` en búsquedas y páginas profundas.

---

## 13. Rendimiento y caché

- Render en servidor; componentes cliente solo para galería, filtros interactivos y formulario.
- Imágenes en CDN con `srcset` y formatos modernos (AVIF/WebP con fallback).
- Caché de página con `revalidate` ≤ 60 s e invalidación por evento.
- Precarga de la ruta de detalle al hacer hover/focus en la tarjeta (**PROPUESTA**).
- Sin librerías de UI pesadas en páginas públicas; presupuesto de JS ≤ 180 KB gzip.

---

## 14. Accesibilidad del marketplace

- Galería operable por teclado con botones anterior/siguiente y anuncio del índice.
- Filtros como `fieldset`/`legend`, con conteos anunciados.
- Resultados en lista semántica; cambio de resultados anunciado con `aria-live="polite"`.
- Formulario con errores asociados y resumen al inicio si hay varios.
- Contraste y foco según NFR-A.
- Sin dependencia exclusiva del color para condición o estado.

---

## 15. Qué el marketplace NO hace

- No muestra publicaciones de negocios suspendidos, sin suscripción en `TRIALING`/`ACTIVE` o con la publicación archivada; **no** existe filtro de "pendiente de aprobación" porque no hay revisión previa.
- No permite comprar, pagar, reservar ni apartar artículos.
- No duplica el inventario ni mantiene una copia propia del catálogo.
- No publica reseñas ni calificaciones verificadas en el MVP.
- No expone datos de contacto privados del negocio.
- No permite que el negocio pague por posicionamiento (no hay ranking pagado).
- No envía mensajes masivos a compradores.
