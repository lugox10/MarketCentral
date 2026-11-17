# ADR-009 — Atributos dinámicos de publicación: JSONB validado

- **Estado:** **APROBADA**
- **Fecha:** 2026-11-12
- **Decisores:** Arquitectura de datos/backend; aprobación pendiente del responsable de producto
- **Ámbito:** `listing.attributes`, `attribute_definition`, `attribute_option`
- **Relacionados:** [ADR-008](ADR-008-domain-data-model.md), [10 §5](../10-data-and-persistence-strategy.md), [16 §10](../16-data-dictionary.md)

---

## 1. Contexto

Cada vertical (Prenderías, Joyerías, Zapaterías…) necesita atributos distintos: un celular tiene marca, modelo y batería; una joya tiene material, quilates y peso. El MVP debe agregar verticales **sin migrar** las tablas centrales y sin llenar `listing` de columnas específicas por sector.

Restricciones:

- PostgreSQL 18 en Neon Free: `jsonb`, GIN `jsonb_path_ops` y `pg_trgm` disponibles; sin motor de búsqueda externo ([ADR-006](ADR-006-production-database-provider.md)).
- Prisma 7: soporta `Json` y filtros `path`/`string_contains`; los índices GIN se declaran en la migración SQL, no en el modelo.
- La validación semántica contra definiciones **no** puede hacerse con un `CHECK` de PostgreSQL (requiere leer otra tabla).
- Los filtros del catálogo se deciden en PublicCatalog (Prompt 04, Q-13) y no deben quedar bloqueados por el almacenamiento.

---

## 2. Decisión

**Alternativa C: definiciones tipadas + valores en JSONB validado en la aplicación**, con estas condiciones:

1. `attribute_definition` declara `vertical_id`, `category_id` opcional, `key`, `data_type` (`TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, `ENUM`), `required`, `filterable`, `searchable`, `validation` (JSONB acotado) y `sort_order`.
2. `attribute_option` guarda las opciones de los atributos `ENUM`.
3. `listing.attributes` es un objeto JSONB (`jsonb_typeof = 'object'`) con valores **normalizados**: número como número, booleano como booleano, `ENUM` como `key` de la opción en minúsculas, `DATE` como `YYYY-MM-DD`.
4. La validación ocurre en el caso de uso `PublishListing`/`UpdateListing` contra las definiciones vigentes del par (vertical, categoría), con herencia vertical → categoría ([16 §10](../16-data-dictionary.md)).
5. Se indexa con `GIN (attributes jsonb_path_ops)`; los índices de expresión por clave se añaden solo para atributos `filterable` con uso demostrado.
6. `attributes_schema_version` registra la versión de definiciones con la que se guardó el valor, para permitir migraciones de datos controladas.
7. Cambiar el `data_type` de una definición con datos existentes exige migración de datos y ventana de compatibilidad; se prohíbe el cambio silencioso.
8. **`condition_code` no es un atributo configurable** (**C-11.3 / D-13, APROBADA**): es un enum fijo de PostgreSQL en `listing` (`NEW`, `LIKE_NEW`, `GOOD`, `FAIR`, `POOR`, `NOT NULL`). Tiene columna propia porque el catálogo filtra y ordena por ella sin leer JSONB, y porque todas las verticales comparten el mismo vocabulario de conservación. Si una vertical necesita más granularidad, se declara `attribute_definition` con `key='condition_detail'` (por ejemplo `"batería hinchada"`, `"talla ajustada"`); **nunca** se amplía el enum ni se convierte `condition_code` en atributo configurable.

---

## 3. Alternativas consideradas

| Alternativa | Descripción | Ventajas | Por qué no se elige |
|-------------|-------------|----------|---------------------|
| **A. Columnas por vertical** | Tabla ancha o una tabla por sector | Consultas simples, tipado fuerte | Cada vertical nueva exige migración; contradice el requisito multi-vertical |
| **B. EAV puro** | `attribute_value(listing_id, attribute_id, value_text)` | Máxima flexibilidad | Un join por atributo; filtros y ordenamientos costosos; tipado débil en la BD |
| **C. JSONB validado (elegida)** | Definiciones + `listing.attributes` | Una tabla, filtros con GIN, sin migración por vertical | Validación en aplicación; riesgo de inconsistencia si se salta la capa |
| **D. Híbrido** | JSONB + tabla de valores para atributos filtrables | Filtros muy rápidos | Doble escritura y sincronización; el volumen del MVP no lo justifica |
| **E. Documento externo** (MongoDB) | Atributos en otro motor | Esquema libre | Segundo motor, transacciones cruzadas, más operación y costo |

### 3.1 Comparación

| Criterio | A | B | C | D | E |
|----------|---|---|---|---|---|
| Agregar vertical sin migrar | ❌ | ✅ | ✅ | ✅ | ✅ |
| Validación de tipos | ✅ | ⚠️ | ✅ (app) | ✅ | ⚠️ |
| Filtros del catálogo | ✅ | ⚠️ | ✅ (GIN) | ✅✅ | ✅ |
| Complejidad operativa | Baja | Media | Baja | Alta | Alta |
| Riesgo de inconsistencia | Bajo | Alto | Medio | Medio | Medio |
| Costo de cambio | Alto | Medio | Bajo | Alto | Alto |

---

## 4. Validación (contrato de escritura)

| Tipo | Regla |
|------|-------|
| `TEXT` | string; `maxLength` (default 200); `regex` si existe; sin HTML |
| `NUMBER` | número finito; `min`/`max`; sin notación científica; hasta 2 decimales |
| `BOOLEAN` | `true`/`false` |
| `DATE` | `YYYY-MM-DD`; rango `minDate`/`maxDate`; no futura salvo indicación |
| `ENUM` | `key` de una `attribute_option` activa o usada históricamente |

**Reglas transversales**

- Claves de `attributes` deben existir como definiciones activas; una clave desconocida se rechaza (`UNKNOWN_ATTRIBUTE`), salvo que esté marcada como histórica.
- Las claves prohibidas (`__proto__`, `constructor`, `prototype`) se rechazan.
- Profundidad máxima 2; tamaño máximo del objeto 8 KB.
- Un `required` ausente bloquea la publicación (`MISSING_REQUIRED_ATTRIBUTES`), no el borrador.
- Los valores se guardan normalizados (minúsculas para `ENUM`, número para `NUMBER`) para que el filtro `@>` funcione.

---

## 5. Consecuencias

### 5.1 Positivas

- Agregar una vertical es **configuración**, no migración.
- Un solo índice GIN cubre filtros por cualquier atributo del MVP.
- Los ejemplos de celular y joya ([15 §9](../15-entity-relationship-model.md)) conviven en la misma tabla.
- El catálogo no necesita conocer el esquema de cada sector.

### 5.2 Negativas

| Costo | Detalle | Mitigación |
|-------|---------|------------|
| Validación solo en aplicación | Un `INSERT` directo podría guardar basura | Única ruta de escritura en `Listings`; el rol de aplicación no se usa para escritura manual; pruebas de validación por tipo |
| Índices de expresión por atributo | Cada atributo filtrable añade costo de escritura | `filterable` es decisión de producto; se indexa solo con uso demostrado |
| Consultas menos legibles | `attributes @> '{"talla":"m"}'` frente a `talla = 'm'` | Vistas o helpers en el repositorio; no se exponen claves al frontend sin definición |
| Migración de tipos | Cambiar `TEXT` a `NUMBER` con datos | `attributes_schema_version` + script de migración con respaldo |
| `ORDER BY` por atributo | Ordenar por un valor JSONB requiere expresión | El MVP ordena por precio y fecha; ordenar por atributo es fase 2 |

### 5.3 Cuándo se reconsideraría

1. Más de 15 atributos filtrables por vertical con filtros combinados frecuentes.
2. Necesidad de ordenar por atributo en el catálogo.
3. Reportes analíticos que requieran agregaciones por atributo a gran escala.
4. Aparición de un requisito de integridad fuerte (p. ej. auditoría que exija FK por valor).

En esos casos, el paso natural es la alternativa D (proyección de valores filtrables), no EAV puro.

---

## 6. Reglas operativas

| Regla | Detalle |
|-------|---------|
| Desactivar una definición | `status='INACTIVE'`; los valores existentes se conservan y se siguen mostrando |
| Desactivar una opción | `is_active=false`; los valores históricos siguen válidos en lectura |
| Renombrar una `key` | Prohibido: se crea una nueva y se migran datos |
| Cambiar `required` | Permitido; no invalida publicaciones ya publicadas hasta su próxima edición |
| Borrar una definición | Solo si no hay valores en publicaciones; en la práctica se desactiva |

---

## 7. Criterios para revisar esta decisión

1. El catálogo necesita ordenar por atributo.
2. Los filtros combinados superan el rendimiento aceptable (p95 > 300 ms) con el GIN actual.
3. Se incorpora un tipo de atributo nuevo (multivalor, rango, archivo) que el JSONB actual no representa bien.
4. Se exige integridad referencial por valor (FK a `attribute_option`).

---

## 8. Historial

| Fecha | Cambio |
|-------|--------|
| 2026-11-12 | Creación del ADR como PROPUESTA, con la comparación de [10 §5](../10-data-and-persistence-strategy.md) |
| 2026-11-12 | **C-11.3 / D-13:** `condition_code` queda como enum fijo en `listing`; la granularidad adicional se modela como atributo `condition_detail` |
| 2026-11-12 | **C-13:** el ADR pasa de PROPUESTA a **APROBADA** al aprobarse el roadmap (docs/22–23) y cerrarse D-19 |
