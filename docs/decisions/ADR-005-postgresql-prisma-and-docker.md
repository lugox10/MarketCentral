# ADR-005 — PostgreSQL + Prisma + Docker en desarrollo local

| Campo | Valor |
|-------|-------|
| **Estado** | **APROBADA** (motor, ORM y entorno local) · Versiones exactas: **PROPUESTA** |
| **Fecha** | 2026-11-12 |
| **Decisor** | Responsable del proyecto (Prompt 01) |
| **Ámbito** | Persistencia, migraciones, entorno local |
| **Relacionados** | [10](../10-data-and-persistence-strategy.md), [14](../14-version-matrix-and-sources.md), [ADR-006](ADR-006-production-database-provider.md) |

---

## 1. Contexto

Se necesita un motor relacional con integridad fuerte (multi-tenant, estados, límites de plan), un ORM con migraciones versionadas y un entorno local reproducible sin depender de servicios cloud ni credenciales.

## 2. Alternativas

| Alternativa | Evaluación |
|-------------|------------|
| **A. PostgreSQL + Prisma + Docker Compose (elegida)** | Motor maduro, tipos, transacciones, `jsonb`, `tsvector`; Prisma con migraciones versionadas y tipos TS; Docker para reproducibilidad |
| B. MySQL/MariaDB + Prisma | Válido, pero `jsonb`, índices GIN y búsqueda textual son inferiores para este caso |
| C. PostgreSQL + TypeORM/Drizzle | Viables; Prisma ofrece mejor ergonomía de migraciones y tipos para el equipo |
| D. MongoDB | Esquema flexible, pero se pierden integridad relacional y restricciones |
| E. SQLite en local | Rápido, pero divergencias con producción (tipos, concurrencia, features) |

## 3. Decisión

1. **PostgreSQL** es el motor relacional, versión objetivo **18.x** (18.7 al 2026-11-12).
2. **Prisma ORM 7.10.1** (versión exacta) como ORM y gestor de migraciones. El tag `latest` del CLI apunta a un release candidate de la v8: **no se usa `latest`**.
3. **Docker Compose** para el entorno local: servicio PostgreSQL 18 con volumen persistente, healthcheck y configuración por variables de entorno. Mínimo un servicio; se podrán añadir Mailpit y MinIO en el Prompt 02 si se aprueba.
4. **Solo `api` y `worker` acceden a la base de datos.** Next.js no tiene cliente Prisma ni cadena de conexión.
5. **Migraciones versionadas** en el repositorio; `prisma migrate dev` en local y `prisma migrate deploy` en entornos compartidos; `prisma db push` prohibido como sustituto.
6. **Producción:** PostgreSQL gestionado en **Neon, plan Free**, región `aws-sa-east-1` (São Paulo), con escalado a Launch ([ADR-006](ADR-006-production-database-provider.md), APROBADA el 2026-11-12). Conexión con pooler transaccional para `api`/`worker` y conexión directa para migraciones.

## 4. Consecuencias

**Positivas**

- Integridad referencial y transacciones ACID para reglas críticas.
- Esquema tipado y migraciones revisables.
- Entorno local idéntico al motor de producción, sin instalar PostgreSQL en el host.
- `jsonb` + GIN permiten atributos configurables sin motor adicional.

**Negativas**

- Prisma abstrae SQL; consultas complejas requieren `$queryRaw` revisado.
- Las migraciones de Prisma son archivos SQL generados: requieren revisión humana.
- Docker añade requisito de recursos en el equipo de desarrollo.
- El ORM fija restricciones (p. ej. RLS no es de primera clase).

**Mitigaciones**

- Revisión obligatoria del SQL generado antes de commitear una migración.
- Pruebas de integración contra PostgreSQL real (contenedor), no mocks de base de datos.
- Documentar consultas `$queryRaw` con justificación y parámetros vinculados.
- Verificar `EXPLAIN ANALYZE` de las consultas del catálogo.

## 5. Riesgos abiertos

| Riesgo | Estado |
|--------|--------|
| Prisma 8 GA y migración | PENDIENTE; planificar tras GA |
| ESM en NestJS 12 con Prisma | Verificar en el arranque del proyecto |
| Pooler y prepared statements | Verificar con el adaptador elegido (`@prisma/adapter-neon` vs `@prisma/adapter-pg`); el pooler de Neon no admite estado de sesión |
| Versión exacta de PostgreSQL en producción | La define Neon al crear el proyecto; **verificar en consola** y registrar en [14](../14-version-matrix-and-sources.md) |
| Backups gestionados | El plan Free de Neon no incluye backups diarios; se depende de *instant restore* (6 h) y de `pg_dump` semanal propio ([ADR-006](ADR-006-production-database-provider.md) §2.5) |

## 6. Criterios para revisar esta decisión

1. Prisma 8 es GA y estable, con guía de migración verificada.
2. El proveedor de producción no soporta la versión objetivo de PostgreSQL.
3. Una consulta crítica no se puede expresar de forma mantenible con Prisma.
4. El equipo decide cambiar de ORM por una razón medida (no por preferencia).
