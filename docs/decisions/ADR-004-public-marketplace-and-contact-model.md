# ADR-004 — Catálogo público agregado y modelo de contacto

| Campo | Valor |
|-------|-------|
| **Estado** | **APROBADA** (principios) · Jerarquía de contacto: **PROPUESTA** |
| **Fecha** | 2026-11-12 |
| **Decisor** | Responsable del proyecto (Prompt 01) |
| **Ámbito** | Producto, catálogo público, leads, pagos |
| **Relacionados** | [11](../11-public-marketplace-experience.md), [06](../06-core-flows-and-state-machines.md), [02](../02-mvp-scope.md) |

---

## 1. Contexto

El comprador debe explorar la oferta de muchos negocios de una misma vertical, contactar al negocio y acordar la compra **fuera** de la plataforma. La plataforma cobra suscripciones a los negocios, no comisiones por venta.

Esto plantea tres decisiones acopladas:

1. ¿El catálogo público es una copia del inventario o una consulta sobre él?
2. ¿Qué significa "contactar": un mensaje persistido, una conversación externa, o ambos?
3. ¿Dónde ocurre el pago del artículo?

## 2. Alternativas

### 2.1 Catálogo

| Alternativa | Descripción | Evaluación |
|-------------|-------------|------------|
| **A. Consulta sobre publicaciones (elegida)** | El catálogo lee las publicaciones existentes y aplica reglas de visibilidad; caché corta | Sin duplicación ni desincronización; una sola fuente de verdad |
| B. Índice de búsqueda materializado | Copia a un motor externo | Mejor búsqueda, pero duplicación, sincronización y costo; no justificado en MVP |
| C. Tabla "catálogo" separada | Copia de publicaciones visibles | Riesgo de servir datos obsoletos; doble escritura |

### 2.2 Contacto

| Alternativa | Descripción | Evaluación |
|-------------|-------------|------------|
| **A. Dos canales explícitos (elegida)** | WhatsApp externo sin registro + formulario que crea `Lead` | Refleja la realidad del negocio; trazabilidad donde se puede medir |
| B. Solo WhatsApp | Todo se negocia externo | Cero trazabilidad para el negocio y la plataforma |
| C. Solo formulario | Mensajería interna o lead obligatorio | Fricción alta; WhatsApp es el canal natural del segmento |
| D. Mensajería interna | Chat dentro de la plataforma | Fuera de alcance; moderación y tiempo real |

### 2.3 Pago

| Alternativa | Descripción | Evaluación |
|-------------|-------------|------------|
| **A. Fuera de la plataforma (elegida)** | Comprador y negocio acuerdan pago y entrega | Sin riesgo de custodia, sin checkout, sin comisión |
| B. Checkout con escrow | La plataforma retiene y libera el dinero | Complejidad legal, financiera y operativa; fuera de alcance |
| C. Comisión por venta | La plataforma cobra un porcentaje | Requiere medir ventas reales; el negocio no reportaría |

## 3. Decisión

1. **El catálogo público consulta las publicaciones existentes.** No existe una copia del inventario. `PublicCatalog` es una capacidad de lectura, no un dueño de datos.
2. **Visibilidad:** una publicación aparece solo si cumple `VisibilityPolicy` (estado `PUBLISHED`, negocio `APPROVED`, vertical habilitada y activa, categoría activa, suscripción vigente, sin bloqueo de moderación).
3. **WhatsApp** es un enlace externo (`wa.me`) generado en el servidor con el número del negocio. **No crea Lead**, no persiste conversación y no cambia estados.
4. **Formulario web** valida y persiste un `Lead` asociado al negocio y, cuando corresponde, a la publicación. Es el único canal que genera trazabilidad.
5. **El pago de artículos ocurre fuera de la plataforma.** No hay checkout de productos, órdenes, escrow, pagos divididos ni comisión por compraventa.
6. **La suscripción del negocio es un flujo separado** del pago de artículos. El proveedor de cobro sigue **PENDIENTE** (Q-06) y el ciclo de vida se documenta en [06 §11](../06-core-flows-and-state-machines.md).

## 4. Consecuencias

**Positivas**

- Una sola fuente de verdad para el inventario.
- Menor superficie legal y financiera (sin custodia de dinero de terceros).
- El negocio mantiene el control de la relación comercial.
- El valor para el negocio se mide en leads atendidos y visibilidad, no en ventas reportadas.

**Negativas**

- No se puede medir la venta real ni atribuir ingresos por transacción.
- Los leads pueden ser de baja calidad o spam (mitigado con rate limit y marcado).
- La experiencia de contacto depende de que el negocio configure bien su WhatsApp.
- El catálogo puede quedar vacío si los negocios no publican (riesgo comercial R-14).

**Mitigaciones**

- Métricas de valor: publicaciones activas, leads recibidos, tasa de respuesta declarada.
- Verificación y onboarding asistido de negocios.
- Reglas de visibilidad claras y comunicadas.
- Evento analítico de clic de WhatsApp **separado y opcional** (Q-11), nunca mezclado con Leads.

## 5. Criterios para revisar esta decisión

1. Se decide incorporar pagos o comisión por venta (cambio de modelo de negocio).
2. Se adopta mensajería interna o WhatsApp Business API con persistencia.
3. El volumen de catálogo exige un motor de búsqueda externo (se reevalúa la alternativa B **solo** con evidencia de rendimiento).
4. Un requisito legal exige registrar el contenido de las conversaciones.
