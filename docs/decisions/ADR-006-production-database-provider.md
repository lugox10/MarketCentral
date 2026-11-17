# ADR-006 — Proveedor de PostgreSQL en producción

| Campo | Valor |
|-------|-------|
| **Estado** | **APROBADA** (2026-11-12, decisión C-07) |
| **Fecha** | 2026-11-12 (propuesta inicial) · 2026-11-12 (aprobación) |
| **Decisor** | Responsable del proyecto |
| **Ámbito** | Infraestructura de datos en producción |
| **Relacionados** | [10](../10-data-and-persistence-strategy.md), [14](../14-version-matrix-and-sources.md), [08 §8](../08-non-functional-requirements.md), [ADR-005](ADR-005-postgresql-prisma-and-docker.md), [12 §8](../12-risks-and-open-decisions.md) |

---

## 1. Contexto

El MVP necesita PostgreSQL administrado en producción, con: respaldo y recuperación utilizables, conexión compatible con Prisma, latencia razonable desde Colombia, costo acorde a un proyecto inicial y posibilidad de crecer sin migrar de proveedor en el corto plazo.

Restricciones conocidas al momento de decidir:

- El catálogo público debe estar **disponible**: la indisponibilidad del proveedor se traduce en pérdida de visitas y de contactos.
- Prisma 7 usa pooling: se requiere conexión directa para migraciones y un pooler para runtime.
- El equipo es pequeño: la operación debe ser mínima (R-21).
- Presupuesto objetivo del MVP ≤ 100 USD/mes de infraestructura (**PROPUESTA**, NFR-K-01).
- La autenticación, la autorización y el almacenamiento de archivos **no** se delegan al proveedor de base de datos: viven en NestJS y en Cloudflare R2 ([07](../07-security-and-multitenancy.md), [ADR-003](ADR-003-multitenancy-strategy.md)).

### 1.1 Corrección de una restricción anterior

La versión inicial de este ADR (estado PENDIENTE) afirmaba que *"un tier gratuito que pausa el proyecto por inactividad no es aceptable"*. Esa restricción se **revisa** aquí porque confundía dos comportamientos distintos:

| Comportamiento | Efecto | ¿Aceptable en el MVP? |
|----------------|--------|-----------------------|
| Pausa del **proyecto** por días de inactividad (p. ej. Supabase Free, 1 semana) | El proyecto deja de servir; requiere reactivación manual desde la consola | **No** |
| Suspensión del **cómputo** por minutos de inactividad (Neon Free, 5 min, *scale-to-zero*) | Los datos siguen almacenados; la primera consulta despierta el cómputo en unos segundos; no hay intervención manual | **Sí, con mitigación** (§2.4) |

La distinción es la base de la decisión: el riesgo real no es que el cómputo se apague, sino que el servicio quede fuera de línea hasta que una persona lo reactive.

## 2. Decisión

**APROBADA:** adoptar **Neon** como proveedor de PostgreSQL gestionado para el MVP, en su **plan Free**, con la región **AWS South America (São Paulo) `aws-sa-east-1`**, y ruta de escalado al plan **Launch** cuando se cumpla alguna de las condiciones de §2.2.

| Elemento | Decisión | Estado |
|----------|----------|--------|
| Proveedor | Neon | APROBADA |
| Plan inicial | Free (0 USD/mes) | APROBADA |
| Región | `aws-sa-east-1` (São Paulo) | APROBADA |
| Versión de PostgreSQL | La que ofrezca Neon en el momento de crear el proyecto (18.x a la fecha); verificar en la consola y registrar en [14](../14-version-matrix-and-sources.md) | PENDIENTE de verificación al crear el proyecto |
| Conexión de runtime | Endpoint **pooled** (`-pooler`, PgBouncer en modo transacción) | PROPUESTA (verificar en *spike*) |
| Conexión de migraciones | Endpoint **directo** (sin `-pooler`) | APROBADA |
| Plan de escalado | Launch | APROBADA como ruta; el momento de activación es PENDIENTE |

**Motivos de la elección (aportados por el decisor y verificados donde era posible):**

1. **Región elegible.** Neon permite crear el proyecto en São Paulo (`aws-sa-east-1`), la región cloud más cercana a Colombia de su catálogo. Supabase Free y Aiven Free no permiten elegir región en sus planes gratuitos. La región **se fija al crear el proyecto y no se puede cambiar** (para cambiar de región hay que crear un proyecto nuevo y migrar), por lo que la elección inicial importa.
2. **Costo cero y sin expiración.** Free no tiene costo mensual y no expira; sus límites (1 GB de storage, 100 CU-hours/mes, hasta 2 CU de autoscaling) son suficientes para un MVP de 10–50 negocios.
3. **No se necesita el ecosistema "todo en uno".** Auth, storage, Data API y RLS de Supabase no se adoptan ([ADR-003](ADR-003-multitenancy-strategy.md)); pagar por un ecosistema que no se usa no aporta valor.
4. ***Scale-to-zero* aceptable.** El tráfico del MVP es intermitente; suspender el cómputo tras 5 minutos reduce el consumo y, con la mitigación de §2.4, no rompe la experiencia.

### 2.1 Límites del plan Free (verificados el 2026-11-12)

Fuente: `https://neon.com/docs/introduction/plans` y `https://neon.com/docs/guides/scale-to-zero-guide`.

| Límite | Valor | Consecuencia para el MVP |
|--------|-------|--------------------------|
| Precio | 0 USD/mes | Sin costo de base de datos en el MVP |
| Storage | **1 GB por proyecto** (20 GB por cuenta) | Techo realista: ~10.000 publicaciones con texto, sin contar imágenes (que van a R2). Monitorear |
| Cómputo | **100 CU-hours por proyecto/mes** | Equivale a 0,25 CU encendido 400 h/mes. Un 0,25 CU encendido 24/7 consumiría ~182 CU-h/mes → **excede el plan**; el *scale-to-zero* no es opcional, es lo que mantiene el consumo dentro del límite |
| Autoscaling | Hasta **2 CU** (8 GB RAM) | Suficiente para el catálogo del MVP; sin margen para cargas analíticas |
| *Scale-to-zero* | Tras **5 min** de inactividad; **no se puede desactivar** en Free | Primera consulta tras suspensión paga el arranque (§2.4) |
| Conexiones | `max_connections` 112 en 0,25 CU (105 útiles) | El pooler es obligatorio en la práctica; ver §2.3 |
| Egress público | 5 GB/proyecto incluido | El tráfico de API es JSON pequeño; las imágenes salen de R2, no de Neon |
| Monitoreo | 1 día de métricas | No alcanza para análisis de tendencia; se cubre con métricas propias (RED) |
| Restauración | *Instant restore* sin costo hasta **6 h**; ventana de historial 6 h / 1 GB de cambios; **1 snapshot manual** | **Free no incluye backups diarios programados** → se requiere respaldo lógico propio (§2.5) |
| SLA | No disponible | El riesgo se asume y se mitiga; no hay compensación contractual |
| Soporte | Community | Sin canal de soporte con tiempos |

### 2.2 Condiciones de escalado a Launch

Se activa el plan Launch (**PENDIENTE** el momento exacto) cuando ocurra **cualquiera** de estas condiciones:

1. El storage del proyecto supera **~800 MB** (80 % de 1 GB) de forma sostenida.
2. El consumo de cómputo supera **~85 CU-hours/mes** de forma sostenida (85 % de 100).
3. Las métricas propias muestran que el arranque en frío degrada el objetivo de latencia del catálogo (NFR-P, p95 de catálogo ≤ 300 ms) en más del 1 % de las solicitudes, o genera errores visibles.
4. Se necesita **desactivar** el *scale-to-zero* o mantener el cómputo caliente en horario comercial.
5. Se requiere **SLA**, backups gestionados con retención mayor, PITR de 7 días o soporte con tiempos de respuesta.
6. Se necesita más de 1 CU de forma sostenida o más conexiones que las disponibles.

Costo de referencia al escalar: **0,106 USD/CU-hour** y **0,35 USD/GB-mes** de storage; el consumo se factura por uso, sin mínimo mensual (`https://neon.com/docs/introduction/plans`). Con ~100 CU-hours y 2 GB, el orden de magnitud es **≈ 10–12 USD/mes**, todavía por debajo del presupuesto (**inferencia aritmética**, no cotización).

Condición de reversa: si el consumo real del MVP se mantiene por debajo de los umbrales durante 3 meses, se permanece en Free.

### 2.3 Conexión desde Prisma

Neon expone dos cadenas de conexión sobre el mismo proyecto (`https://neon.com/docs/connect/connection-pooling`):

| Uso | Cadena | Notas |
|-----|--------|-------|
| Runtime (`api`, `worker`) | Host con sufijo **`-pooler`** → PgBouncer `pool_mode=transaction`, `max_client_conn=10000`, `max_prepared_statements=1000` | Conexiones cortas y muchas solicitudes concurrentes |
| CLI de Prisma (`migrate`, `introspect`, `db pull`) y `pg_dump` | Host **sin** `-pooler` | El pooler en modo transacción no soporta `SET`, `LISTEN`, `PREPARE` a nivel SQL ni cursores `WITH HOLD` |

Configuración esperada (a validar en *spike*, no implementada en esta fase):

- Dos variables: `DATABASE_URL` (pooled) y `DATABASE_URL_UNPOOLED` (directa). En Prisma 7 la conexión del CLI se declara en `prisma7.config.ts` (`prisma.config.ts` en 7.x anteriores); **no** se pone `url` en el bloque `datasource` (`https://neon.com/docs/guides/prisma`).
- Dos opciones de driver, ambas **PROPUESTAS** hasta el *spike*:
  - **A — `@prisma/adapter-neon`** (guía oficial de Neon para Prisma 7): usa el driver serverless sobre WebSocket. Es la ruta documentada y no requiere `pgbouncer=true`.
  - **B — `@prisma/adapter-pg`** (node-postgres) con la cadena pooled y `?pgbouncer=true`: evita WebSocket en un servidor NestJS de larga vida. Requiere verificar el manejo de *prepared statements*.
- La elección se registra como ADR propio si el *spike* muestra diferencias de comportamiento o rendimiento.
- `connect_timeout=15` y reintento único ante error de conexión (§2.4). `connection_limit` y `pool_timeout` de la URL **no** aplican con el adaptador de Neon: se configuran en el adaptador (`max`, `connectionTimeoutMillis`).

**Compatibilidad de Prisma 7 con PG 18:** Prisma 7 declara soporte de PostgreSQL 9.6–18; Neon ofrecerá 18.x. Verificado en [14](../14-version-matrix-and-sources.md).

### 2.4 *Scale-to-zero* y arranque en frío

Al suspenderse el cómputo, la primera consulta lo reactiva; el arranque tarda unos segundos y puede superar el `connect_timeout` por defecto. Mitigaciones **PROPUESTAS**:

1. `connect_timeout=15` en las cadenas de conexión y **un reintento** con espera corta en el adaptador de base de datos, solo para errores de conexión (no para errores de negocio).
2. `/health/ready` distingue *degradado por arranque* de *caído*: si el *ping* falla una vez, responde `503` con `Retry-After: 5` en lugar de propagar el error a la página.
3. La página de catálogo sirve una versión en caché (TTL ≤ 60 s) mientras la base despierta, sin mostrar un error al comprador (NFR-D-04).
4. **No** se implementa *keep-alive* permanente en Free: a 0,25 CU durante 730 h se consumirían ~182 CU-hours/mes, casi el doble del límite. Si el negocio necesita cómputo caliente, se escala a Launch (§2.2), que permite desactivar el *scale-to-zero*.

Consecuencia declarada: en el MVP, la primera visita tras un periodo de inactividad puede tardar **1–5 s** en responder con datos frescos. Es una degradación **aceptada**, medida y revisada con las condiciones de §2.2.

### 2.5 Respaldo y recuperación con el plan Free

El plan Free **no** ofrece backups diarios programados; ofrece *instant restore* sobre una ventana de 6 h y **un** snapshot manual. Por lo tanto, el plan de respaldo del MVP se compone de:

| Mecanismo | Frecuencia | Retención | Cubre |
|-----------|-----------|-----------|-------|
| *Instant restore* de Neon | Continuo (historial 6 h) | 6 h, hasta 1 GB de cambios | Error humano o migración fallida reciente |
| Snapshot manual de Neon | Antes de cada migración y semanalmente | 1 snapshot (rotar) | Punto de retorno estable |
| `pg_dump` lógico a Cloudflare R2 | Semanal (job del `worker`) | 12 semanas | Recuperación ante pérdida del proyecto o corrupción antigua |
| Migraciones versionadas en el repositorio | Cada cambio de esquema | Historial de Git | Reconstrucción del esquema |

Con esto, el **RPO** es ≤ 7 días para desastre total y ≤ 6 h para error reciente; el **RTO** objetivo es ≤ 4 h (NFR-B-02). La restauración se prueba **antes del lanzamiento** y luego trimestralmente, con acta (NFR-B-03). Estas cifras **sustituyen** el supuesto anterior de "backups diarios del proveedor" en [08 §8](../08-non-functional-requirements.md).

### 2.6 Alternativas evaluadas

| Alternativa | Costo inicial | Motivo de descarte para el MVP | Estado |
|-------------|---------------|-------------------------------|--------|
| **Neon Free** | 0 USD | — (elegida) | **APROBADA** |
| Neon Launch | ~10–15 USD/mes según uso | No se necesita pagar por uso antes de medirlo; es la ruta de escalado | Rechazada por ahora (reversible) |
| Supabase Pro | 25 USD + cómputo (10 USD Micro) | Pago por un ecosistema (Auth, Storage, Data API, RLS) que no se adopta; región elegible pero costo mayor; Free se pausa tras 1 semana | Rechazada para el MVP |
| PostgreSQL autoadministrado (VPS) | 5–20 USD/mes + operación | Backups, PITR, parches y recuperación a cargo de una sola persona (R-21) | Rechazada |
| AWS RDS / Cloud SQL / Azure | > 30–50 USD/mes | Costo mínimo y complejidad de red/credenciales desproporcionados al MVP; sin cotización verificada | Rechazada para el MVP |
| Render / Railway / Fly.io Postgres | No verificado | La página de precios de Render no devolvió cifras utilizables el 2026-11-12; condiciones de backup variables | **NO VERIFICADO** |

### 2.7 Consecuencias

**Positivas**

- Costo de base de datos **0 USD** en el MVP; el presupuesto se concentra en R2, correo y despliegue.
- PostgreSQL estándar: sin extensiones propietarias ni APIs de datos; la salida es un `pg_dump` y un PostgreSQL nuevo (lock-in bajo).
- Región São Paulo reduce la latencia frente a us-east-1 para usuarios en Colombia.
- Prisma funciona sin cambios de modelo: solo cambian las cadenas de conexión y el adaptador.

**Negativas**

- Sin SLA ni soporte con tiempos: una caída del proveedor es una caída del servicio.
- 1 GB de storage y 100 CU-hours son techos cercanos; requieren monitoreo y una decisión de escalado temprana.
- Arranque en frío visible (1–5 s) tras inactividad.
- **Sin backups gestionados diarios**: el respaldo lógico propio es obligatorio desde el día 1, no una mejora posterior.
- La región no se puede cambiar: una decisión equivocada obliga a migrar de proyecto.
- *Scale-to-zero* reinicia el contexto de sesión: no se pueden usar `SET` persistentes, `LISTEN/NOTIFY` ni tablas temporales entre transacciones (compatible con el diseño actual, que no los usa).

**Neutras**

- El proyecto de Neon es único por entorno; staging y producción son proyectos separados (cada uno con su propio límite de 1 GB).

### 2.8 Riesgos asociados y su estado

| Riesgo | Cambio tras esta decisión |
|--------|---------------------------|
| [R-12](../12-risks-and-open-decisions.md) — dependencia de un tier gratuito que pausa el servicio | **Reformulado**: ya no es "pausa del proyecto" sino "suspensión del cómputo". Probabilidad media, impacto medio; mitigado con reintento, caché y `/health/ready` |
| [R-21](../12-risks-and-open-decisions.md) — una sola persona opera la plataforma | Se **reduce** la carga operativa frente a un VPS, pero se **agrega** el respaldo lógico semanal a R2 |
| [R-18](../12-risks-and-open-decisions.md) — pérdida de datos | Se **mitiga parcialmente** con *instant restore* 6 h + `pg_dump` semanal; el RPO de 7 días para desastre total es un riesgo aceptado y documentado |
| L-03 — transferencia internacional de datos | Se mantiene **PENDIENTE** de validación legal: el proyecto reside en AWS São Paulo (Brasil) |

### 2.9 Criterios para revisar esta decisión

1. Storage > 800 MB o cómputo > 85 CU-hours/mes sostenidos → evaluar Launch.
2. p95 del catálogo > 300 ms atribuible al arranque en frío → evaluar Launch con *scale-to-zero* desactivado.
3. Necesidad de SLA, soporte con tiempos o backups gestionados → Launch o proveedor con SLA.
4. Cambio de región requerido (por latencia o por requisito legal) → proyecto nuevo y migración planificada.
5. Si Neon cambia los límites del plan Free o introduce un mínimo mensual.
6. Si el *spike* de Prisma con el adaptador de Neon falla → reevaluar conexión (adaptador `pg`) antes que proveedor.

## 3. Decisiones relacionadas que siguen abiertas

| Tema | Estado | Seguimiento |
|------|--------|-------------|
| Versión exacta de PostgreSQL que ofrece Neon al crear el proyecto | **PENDIENTE** de verificación en la consola | Registrar en [14](../14-version-matrix-and-sources.md) |
| Proveedor de cobro recurrente (suscripciones) | **PENDIENTE** | Q-06 y [05](../05-modules-and-responsibilities.md) |
| Proveedor de correo transaccional | **PENDIENTE** | Q-21 |
| Almacenamiento de objetos (R2 vs S3) | PROPUESTA (R2) | [10](../10-data-and-persistence-strategy.md); costos verificados |
| Región de despliegue de `api` y `web` | **PENDIENTE** | Debe minimizar latencia hacia São Paulo; el proveedor de hosting no está decidido |
| Validación legal de transferencia internacional (Brasil) | **PENDIENTE** | L-03; requiere abogado |

## 4. Historial

| Fecha | Estado | Cambio |
|-------|--------|--------|
| 2026-11-12 | PENDIENTE | ADR creado con comparación de Supabase Pro, Neon Launch, VPS y RDS/Cloud SQL; recomendación provisional Supabase Pro / Neon Launch |
| 2026-11-12 | **APROBADA** | Decisión C-07: Neon Free en `aws-sa-east-1`, escalado a Launch según §2.2. Se corrige la restricción sobre tiers gratuitos (§1.1) y se documenta el respaldo lógico obligatorio (§2.5) |

**Nota sobre el proceso.** La regla 1 de [README](README.md) pide que un cambio de decisión se registre en un ADR nuevo. Este caso **no es un cambio de decisión aprobada**: el ADR estaba en **PENDIENTE**, sin decisión tomada, y lo que se registra aquí es su **aprobación** (con los límites del plan y las condiciones de escalado que faltaban). Si en el futuro se cambia el proveedor o el plan, se creará un ADR nuevo que sustituya a este.
