# 01 — Visión de producto

**Estado:** documento para revisión · **Fecha:** 2026-11-12 · **Fase:** planificación (Prompt 01)

---

## 1. Problema

### 1.1 El negocio (prendería)

Una prendería compra y revende artículos usados —ropa, calzado, accesorios, electrodomésticos, muebles, instrumentos— con inventario rotativo y, en muchos casos, piezas únicas. Hoy su operación comercial depende de:

- **Publicar en redes sociales y mensajería** (estados de WhatsApp, publicaciones en Instagram/Facebook), donde el catálogo caduca rápido, no se puede filtrar y no existe ficha de producto.
- **Responder consultas repetidas** por el mismo canal, sin registro de quién preguntó, por qué artículo ni qué pasó después.
- **No tener escaparate propio**: el comprador que no sigue la cuenta no encuentra el negocio, y el negocio no aparece cuando alguien busca "prendería cerca de mí".
- **Desorden de inventario**: lo vendido sigue publicado, lo disponible no se ve, y el estado real del artículo vive en la cabeza del dueño o en un cuaderno.

### 1.2 El comprador

- Busca un artículo usado concreto (marca, talla, modelo, condición) en un radio razonable.
- Compara entre varios negocios, pero hoy debe entrar cuenta por cuenta de Instagram o preguntar en grupos.
- Desconfía: no sabe si el negocio existe, dónde está, si el artículo sigue disponible ni cómo contactarlo sin exponer su número.

### 1.3 El vacío de mercado

No existe en Medellín y su área metropolitana un **catálogo agregado, filtrable y por sector** de prenderías, con identidad de negocio verificable y con herramientas de gestión para el negocio. Las alternativas existentes (marketplaces generalistas, redes sociales, clasificados) no están especializadas, no modelan atributos del sector y no ofrecen al negocio un panel de inventario, leads y suscripción.

> **Nota de honestidad analítica:** las afirmaciones de mercado anteriores son **hipótesis de producto derivadas del brief**, no un estudio de mercado. No se ha ejecutado investigación primaria ni se han consultado cifras oficiales de número de prenderías, ticket promedio o volumen del sector. Se marcan como SUPUESTO (S-01, S-02) y deben validarse antes de invertir en adquisición.

---

## 2. Propuesta de valor

### 2.1 Para el negocio (prendería)

> "Tu inventario, publicado y encontrable, con las consultas de tus clientes ordenadas en un solo lugar."

- Escaparate web propio dentro de un marketplace especializado, sin construir ni mantener un sitio.
- Catálogo con estado real: lo vendido se marca y desaparece del catálogo público.
- Contacto unificado: leads del formulario web quedan registrados y trazables; WhatsApp sigue siendo el canal directo de siempre.
- Panel privado usable desde el celular para publicar en minutos.
- Suscripción como único costo; **sin comisión por venta**, porque la venta ocurre fuera de la plataforma.

### 2.2 Para el comprador

> "Encuentra lo que buscas en prenderías reales de tu ciudad, filtra por lo que importa y contacta sin dar vueltas."

- Catálogo agregado por vertical, con filtros propios del sector (categoría, condición, talla/medida, marca, rango de precio, ubicación).
- Ficha de publicación con fotos, precio, condición y negocio responsable.
- Perfil público del negocio con sus otras publicaciones activas.
- Dos formas de contacto claras: WhatsApp (inmediato, externo) o formulario (deja rastro y permite respuesta).

### 2.3 Para la plataforma (MarketCentral)

- Un solo producto multi-tenant y multi-vertical que se reutiliza al abrir nuevas verticales (joyerías, zapaterías, etc.) **sin crear una aplicación por sector**.
- Ingreso recurrente por suscripción, predecible y desacoplado del volumen de transacciones de compraventa.
- Activo de datos: taxonomía por vertical, catálogo y comportamiento de contacto (agregado y anonimizado).

---

## 3. Público objetivo y segmentos

| Segmento | Descripción | Prioridad MVP |
|----------|-------------|---------------|
| Prenderías establecidas del área metropolitana de Medellín | Negocio con local o punto de atención, inventario recurrente, ya vende por redes. | **Primario** |
| Prenderías pequeñas / unipersonales | Dueño-operador, sin sistemas, móvil-first. | **Primario** (segmento de mayor volumen y menor costo de activación) |
| Compradores de usados en el AMVA | Personas que buscan precio y disponibilidad, mayoritariamente en móvil. | **Primario** (demanda) |
| Joyerías, zapaterías y otros sectores | Verticales futuras sobre la misma plataforma. | Secundario (fase 2+) |

**Geografía inicial:** Medellín y su área metropolitana (Valle de Aburrá). El modelo de datos no debe impedir otras ciudades, pero el MVP opera en una sola región comercial.

**Perfil de adopción:** el dueño o encargado publica desde el celular, con fotos tomadas en el momento. Cualquier flujo que exija escritorio, edición de imagen profesional o alta de catálogo masivo está fuera del camino crítico.

---

## 4. Modelo de negocio

### 4.1 Fuente de ingreso

**Suscripción mensual del negocio** (SaaS B2B). Es el único ingreso del MVP.

- **No hay comisión por venta**, no hay checkout de artículos, no hay retención de dinero de terceros, no hay escrow. El pago del artículo se acuerda y se ejecuta entre comprador y negocio, fuera de la plataforma. **[APROBADA — restricción del brief]**
- El cobro de la suscripción es un flujo **independiente** del pago de artículos. **[APROBADA]**
- Precio, planes y límites: **APROBADOS con enfoque MVP** (C-10): Free 2 meses / 10 publicaciones / $0; Base 30 / $30.000 COP/mes; Pro 50 / $50.000 COP/mes. Valores sujetos a validación comercial durante el piloto; el modelo (`Plan` + `PlanEntitlement`) no cambia.
- **Cobro manual en el MVP** (Q-06): transferencia o Nequi fuera de la plataforma, activación por un administrador. Sin pasarela hasta fase 2.

### 4.2 Estructura de planes (conceptual)

Tres niveles propuestos, sin precios: un nivel de entrada con límite de publicaciones activas, un nivel estándar y un nivel con mayor visibilidad. Los límites son **entitlements** verificados en backend, nunca en frontend. Detalle en [05-modules-and-responsibilities.md](05-modules-and-responsibilities.md) (Subscriptions) y [06-core-flows-and-state-machines.md](06-core-flows-and-state-machines.md).

**[PROPUESTA]** — la existencia de tres niveles, sus nombres y sus límites requieren aprobación comercial.

### 4.3 Costos y economía unitaria (cualitativa)

Costos principales: infraestructura (dos aplicaciones + PostgreSQL + almacenamiento de objetos), proveedor de correo transaccional, adquisición de negocios (venta en campo) y soporte. **En el MVP no hay comisión de pasarela** porque el cobro es manual; la economía unitaria solo es evaluable cuando existan datos reales de conversión y retención: ambos **PENDIENTE** de medición. No se presentan proyecciones financieras en esta etapa.

### 4.4 Por qué suscripción y no comisión

Porque la plataforma **no participa en la transacción del artículo**: no cobra, no retiene, no garantiza. Cobrar comisión exigiría mediar el pago (checkout, conciliación, disputas, obligaciones regulatorias), lo que está explícitamente fuera del MVP. La suscripción alinea el ingreso con el valor entregado (visibilidad y herramientas) y evita dependencia de reportar ventas privadas.

**Alternativa descartada:** comisión por lead o por venta declarada. Descartada por riesgo de subreporte, fricción de confianza y complejidad operativa.

---

## 5. Actores

### 5.1 Actores humanos

| Actor | Descripción | Permisos de plataforma | Permisos de negocio |
|-------|-------------|------------------------|---------------------|
| **Visitor** | No autenticado. | Solo lectura del catálogo público. | Ninguno. |
| **Buyer / User** | Usuario registrado sin negocio, o con negocio. | Cuenta propia, sus datos, sus leads enviados. | Ninguno por defecto. |
| **Business Owner** | Miembro con rol `OWNER`. | Cuenta propia. | Todo el negocio: perfil, miembros, publicaciones, suscripción, facturación. |
| **Business Admin** | Rol `ADMIN`. | Cuenta propia. | Todo salvo transferir propiedad y cancelar la cuenta del negocio (a confirmar). |
| **Business Editor** | Rol `EDITOR`. | Cuenta propia. | Crear/editar/publicar publicaciones, gestionar leads y media. No gestiona miembros ni suscripción. |
| **Business Viewer** | Rol `VIEWER`. | Cuenta propia. | Lectura del panel y de leads. Sin escrituras. |
| **Moderator** | Personal de plataforma. | Revisar negocios y publicaciones, resolver denuncias, ocultar contenido. | Ninguno (no es miembro de negocios). |
| **Support** | Personal de plataforma. | Lectura acotada para soporte; acceso auditado. | Ninguno. |
| **Platform Admin** | Administración global. | Configurar taxonomía, planes, políticas, usuarios, roles de plataforma. | Ninguno por defecto. |

**Regla:** los permisos de plataforma y los de membresía son **conjuntos disjuntos**. Un `Platform Admin` no obtiene acceso de escritura al inventario de un negocio solo por serlo; si lo necesita para soporte, se hace mediante una acción explícita, acotada y auditada (ver [07-security-and-multitenancy.md](07-security-and-multitenancy.md)).

### 5.2 Actores de sistema

- **api** (NestJS): autoridad de negocio, autenticación, autorización y acceso a datos.
- **web** (Next.js): presentación pública y paneles; consume la API.
- **worker** (mismo artefacto que api, proceso aparte): trabajos programados, despacho de eventos y webhooks, expiraciones.
- **Cobro de suscripciones** (**manual en el MVP**): transferencia o Nequi; un administrador registra el pago y activa la suscripción. Sin integración técnica con pasarela (Q-06).
- **Proveedor de correo** (externo, PENDIENTE): verificación, recuperación, avisos.
- **Almacenamiento de objetos S3-compatible** (externo, candidato R2): imágenes.
- **n8n** (externo, **futuro**): automatizaciones. Consumidor de webhooks; **nunca** dependencia del dominio.
- **Búsqueda / analítica** (futuro): no en MVP.

---

## 6. Objetivos

### 6.1 Objetivos de producto (MVP)

| ID | Objetivo | Criterio de logro (medible) |
|----|----------|------------------------------|
| O-01 | Un negocio puede estar operativo sin asistencia | Alta directa (sin revisión) → vertical → publicar → recibir lead, sin intervención humana salvo la activación de un plan de pago. |
| O-02 | El comprador encuentra por filtros del sector | Búsqueda con ≥3 filtros combinables devuelve resultados correctos y paginados. |
| O-03 | El catálogo refleja el inventario real | Publicación vendida/pausada/vencida deja de ser visible en ≤ 1 minuto (invalidación de caché). |
| O-04 | Todo contacto por formulario queda registrado | 100 % de envíos válidos crean exactamente un `Lead` (idempotencia ante reintentos). |
| O-05 | El negocio paga su suscripción y el acceso se ajusta solo | Webhook del proveedor actualiza estado y entitlements de forma idempotente. |
| O-06 | El aislamiento multi-tenant es demostrable | Suite de pruebas negativas cross-tenant en verde, sin excepciones. |

### 6.2 Objetivos de arquitectura

| ID | Objetivo |
|----|----------|
| A-01 | Añadir una vertical nueva (joyería, zapatería) sin desplegar código nuevo: solo configuración de taxonomía. |
| A-02 | El dominio no depende de HTTP, Prisma, NestJS ni SDKs externos. |
| A-03 | El sistema funciona con n8n, el proveedor de correo o el de cobro caídos (degradación controlada, no caída total). |
| A-04 | Migraciones revisables, reproducibles y reversibles por procedimiento. |

### 6.3 No objetivos

- No ser un e-commerce con carrito, checkout, envíos ni garantías.
- No ser una app móvil nativa.
- No ser un CRM completo ni un ERP de inventario con costos, proveedores y kardex.
- No ser una pasarela de pagos.
- No ser una red social (sin feed, sin seguidores, sin mensajería interna en MVP).

---

## 7. Límites y supuestos

### 7.1 Dentro del alcance del producto

Marketplace público agregado por vertical, panel de negocio, gestión de publicaciones e inventario, leads por formulario, contacto por WhatsApp, suscripciones, moderación y administración de taxonomía. Detalle en [02-mvp-scope.md](02-mvp-scope.md).

### 7.2 Fuera del alcance (explícito)

Checkout de artículos, pagos entre particulares, escrow, comisión por venta, envíos y logística, mensajería interna, app nativa, multi-idioma, multi-moneda, subastas, reseñas verificadas de compra, y toda automatización n8n implementada. **[APROBADA — restricción del brief]**

### 7.3 Supuestos

| ID | Supuesto | Impacto si es falso |
|----|----------|---------------------|
| S-01 | Existe masa crítica de prenderías dispuestas a pagar suscripción. | El modelo de ingreso no se sostiene; habría que revisar precio o modelo (lead/visibilidad). |
| S-02 | El comprador acepta contactar por WhatsApp/formulario y cerrar fuera de la plataforma. | Si exige compra dentro, el alcance cambia por completo (checkout, pagos, disputas). |
| S-03 | Los negocios publican desde el celular, con fotos propias. | Si requieren carga masiva o fotografía profesional, se necesita importación CSV y edición de imagen en fase 2. |
| S-04 | Un artículo usado es, en su mayoría, pieza única (cantidad 1). | Si hay stock múltiple, se requiere control de cantidades y disponibilidad más fino. |
| S-05 | El negocio es responsable de su contenido y de los datos de sus compradores (T&C), sin revisión previa de la plataforma. | Si el contenido ilícito se vuelve frecuente, habría que introducir moderación previa y más personal. |
| S-06 | La operación inicial es una sola región (AMVA) y un solo idioma (es-CO). | Multi-región/multi-idioma altera URLs, SEO y taxonomía. |
| S-07 | No se almacenan datos de tarjetas ni datos financieros de compradores. | Si se almacenaran, cambia el régimen de cumplimiento y el alcance de seguridad (PCI). |
| S-08 | El cobro manual (transferencia/Nequi) es aceptable para los negocios del piloto y la activación por admin no genera fricción excesiva. | Si los negocios exigen pago en línea, se adelanta la pasarela de fase 2 (Q-06). |
| S-09 | El tráfico inicial es bajo (< 50k visitas/mes) y no exige CDN avanzado ni búsqueda externa. | Habría que introducir caché de borde y motor de búsqueda; cambia la arquitectura. |
| S-10 | Los negocios aceptan términos, política de tratamiento de datos y reglas de publicación. | Sin aceptación registrada no hay base legal para tratar datos ni moderar contenido. |
| S-11 | El plan Free de Neon (1 GB, 100 CU-hours, scale-to-zero) alcanza para 10–50 negocios del piloto. | Al superar el umbral se escala a Launch; el costo se vuelve variable (ver ADR-006 §2.2). |

### 7.4 Dependencias externas

- Disponibilidad del proveedor de PostgreSQL en producción (**APROBADA**: Neon Free en São Paulo, [ADR-006](decisions/ADR-006-production-database-provider.md)); su plan Free no tiene SLA y suspende el cómputo tras 5 minutos de inactividad.
- **Cobro de suscripciones: manual en el MVP** (Q-06); la pasarela (Wompi/Mercado Pago) es **fase 2** y su proveedor sigue **PENDIENTE**.
- Disponibilidad del proveedor de correo transaccional (**PENDIENTE**).
- Marco legal colombiano de protección de datos (Ley 1581 de 2012 y normas reglamentarias): en el MVP se usan plantillas estándar de T&C y Política de Privacidad (L-01/L-02, C-10); una revisión legal formal queda **PENDIENTE** antes de escalar.

---

## 8. Métricas de éxito

### 8.1 Métrica principal (North Star)

**Publicaciones activas y contactables por semana** — publicaciones en estado `PUBLISHED`, de negocios `APPROVED` con suscripción vigente y vertical habilitada, que recibieron al menos un contacto (lead o clic de WhatsApp) en la semana.

Mide lo único que importa al inicio: que el catálogo exista, sea visible y genere contacto real.

### 8.2 Métricas de apoyo

| Métrica | Definición | Uso |
|---------|------------|-----|
| Negocios activados | Negocios que publicaron ≥1 artículo en sus primeros 7 días | Calidad del onboarding |
| Tiempo a primera publicación | Mediana desde registro hasta primera publicación | Fricción del flujo |
| Tasa de contacto por publicación | Publicaciones con ≥1 contacto / publicaciones activas | Valor percibido |
| Leads por negocio / semana | Mediana | Justifica la suscripción |
| Conversión a suscripción de pago | Negocios que pasan de trial a pago | Sostenibilidad |
| Churn mensual de negocios | Bajas / activos al inicio del mes | Retención |
| Publicaciones vencidas no renovadas | % de publicaciones que expiran sin renovar | Salud del inventario |
| Latencia p75 del catálogo | TTFB y tiempo de respuesta de listados | Calidad técnica |

**Nota:** "clic de WhatsApp" es un **evento analítico**, no un evento de dominio ni un Lead. Su instrumentación está **PENDIENTE** de aprobación (Q-11): implica registrar un evento por clic, con implicaciones de privacidad y de conteo (bots, doble clic). Si se aprueba, se documenta como evento analítico separado en [09-integrations-and-n8n-readiness.md](09-integrations-and-n8n-readiness.md).

### 8.3 Anti-métricas (lo que no se optimiza)

- Número de publicaciones totales sin filtro de calidad (incentiva spam).
- Clics de WhatsApp sin contexto de conversión (métricas vanidosas).
- Volumen de leads sin tasa de respuesta del negocio.

---

## 9. Riesgos de visión (resumen)

Detalle y mitigaciones en [12-risks-and-open-decisions.md](12-risks-and-open-decisions.md).

| ID | Riesgo | Dirección |
|----|--------|-----------|
| RV-01 | Baja disposición a pagar suscripción en un sector de márgenes ajustados. | Validar precio antes de construir cobro; plan de entrada barato. |
| RV-02 | El comprador prefiere WhatsApp y nunca usa el formulario, dejando el valor de "leads" sin demostrar. | Medir ambos canales; el formulario debe ser de un solo paso y sin registro obligatorio. |
| RV-03 | Inventario desactualizado (lo vendido sigue publicado) destruye la confianza. | Estado `SOLD` a un toque, expiración automática, recordatorios. |
| RV-04 | Contenido ilícito o robado en publicaciones de segunda mano. | Moderación, denuncias, términos, trazabilidad y respuesta rápida. |
| RV-05 | Dependencia de una sola vertical y una sola ciudad. | Taxonomía configurable desde el día uno. |

---

## 10. Decisiones relacionadas

- [ADR-003](decisions/ADR-003-multitenancy-strategy.md) — multi-tenancy por membresías.
- [ADR-004](decisions/ADR-004-public-marketplace-and-contact-model.md) — catálogo agregado, WhatsApp externo y Lead.
- [ADR-006](decisions/ADR-006-production-database-provider.md) — proveedor de PostgreSQL (**APROBADA**: Neon Free, escalado futuro a Launch).

## 11. Preguntas abiertas que afectan la visión

Q-11 (medición de clic de WhatsApp), Q-20 (correo transaccional) y Q-21 (analítica de producto). **Ya cerradas por C-10:** Q-01 (nombre), Q-02/Q-03 (planes y límites), Q-06 (cobro manual), Q-07 (sin moderación previa), Q-13 (filtros indexados, se deciden en PublicCatalog), Q-15 (COP), Q-16 (ubicación), L-01/L-02 (T&C con plantilla estándar). Todas en [12-risks-and-open-decisions.md](12-risks-and-open-decisions.md). Ninguna bloquea el Prompt 02.
