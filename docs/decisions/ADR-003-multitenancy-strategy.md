# ADR-003 — Multi-tenancy por membresías y aislamiento en aplicación

| Campo | Valor |
|-------|-------|
| **Estado** | **APROBADA** (aislamiento en aplicación) · RLS: **PENDIENTE** |
| **Fecha** | 2026-11-12 |
| **Decisor** | Responsable del proyecto (Prompt 01) |
| **Ámbito** | Seguridad, autorización y modelo de datos |
| **Relacionados** | [07](../07-security-and-multitenancy.md), [04 §2](../04-domain-overview.md), [ADR-006](ADR-006-production-database-provider.md) |

---

## 1. Contexto

Usuarios y negocios tienen relación muchos-a-muchos: una persona puede administrar varias tiendas y una tienda puede tener varios miembros con roles distintos. El sistema debe garantizar que un miembro de un negocio **nunca** pueda leer, modificar o eliminar recursos de otro, incluso si manipula peticiones.

Se evaluó también Row Level Security (RLS) de PostgreSQL como segunda barrera.

## 2. Alternativas

### 2.1 Modelo de tenancy

| Alternativa | Descripción | Evaluación |
|-------------|-------------|------------|
| **A. Membresías con roles (elegida)** | `User` ↔ `Membership` ↔ `Business`; el tenant es `Business` | Refleja el negocio real; un usuario con varios negocios; roles por negocio |
| B. Un negocio por usuario | `Business.ownerId` | Simple, pero impide equipos y varios negocios por persona |
| C. Roles globales | `User.role = "business_admin"` | No escala a multi-negocio; permisos demasiado amplios |
| D. Esquema por tenant | Un schema PostgreSQL por negocio | Aísla fuerte, pero multiplica migraciones y operación; inviable para miles de negocios |
| E. Base de datos por tenant | Una BD por negocio | Aislamiento máximo, costo y operación desproporcionados |

### 2.2 Aislamiento

| Alternativa | Descripción | Evaluación |
|-------------|-------------|------------|
| **A. Scoping obligatorio en aplicación (elegida)** | `businessId` obligatorio en repositorios + `ActorContext` + pruebas negativas | Simple, explícito, compatible con Prisma y poolers |
| B. RLS en PostgreSQL | Políticas por fila con contexto de sesión | Defensa adicional; complejidad con Prisma, pooler y jobs internos |
| C. Vistas por tenant | Vistas filtradas por negocio | Rígido; no cubre escrituras |

## 3. Decisión

1. **Tenant = `Business`**. Un usuario accede a un negocio mediante una `Membership` activa con un rol (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`).
2. El `businessId` se obtiene de la **sesión + ruta**, nunca del cuerpo de la petición; toda operación privada pasa por un `ActorContext` resuelto en el backend.
3. Todo repositorio privado recibe `businessId` como parámetro **obligatorio** y lo incluye en el filtro. Las consultas sin filtro de tenant en rutas privadas son un defecto bloqueante.
4. Los recursos de otro tenant responden **404** (no revelan existencia); los permisos insuficientes dentro del propio tenant responden **403**.
5. **RLS no se adopta en el MVP.** Se reevalúa cuando exista una razón concreta (auditoría, requisito contractual, incidente).

## 4. Consecuencias

**Positivas**

- Modelo flexible para equipos y para usuarios con varios negocios.
- Sin dependencia de características del proveedor de base de datos.
- Funciona igual en local (Docker) y en producción (proveedor pendiente).
- Las pruebas negativas son directas de escribir.

**Negativas**

- El aislamiento depende de disciplina de código; un `where` olvidado es una fuga.
- Sin RLS no hay red de seguridad a nivel de base de datos.
- Los jobs internos (worker, admin) deben construir contexto explícito.

**Mitigaciones**

- Tipo `TenantScopedRepository` que obliga a pasar `businessId`.
- Pruebas N-01…N-15 automatizadas en CI (ver [07 §5.3](../07-security-and-multitenancy.md)).
- Revisión de PR con checklist específico de scoping.
- Rol de base de datos de la aplicación con permisos mínimos (sin `SUPERUSER`, sin `BYPASSRLS`).
- Auditoría de accesos de soporte.

## 5. Criterios para revisar la decisión de RLS

1. Un incidente o casi-incidente de fuga entre tenants.
2. Requisito de un cliente o auditoría que exija defensa a nivel de base de datos.
3. El proveedor de BD elegido facilita el contexto por transacción sin romper el pooling.
4. Se incorpora un canal de acceso a datos distinto de la API (BI, integraciones) que haga necesario el filtrado en la base.

## 6. Nota sobre proveedores gestionados y RLS

El proveedor de producción aprobado es **Neon Free** ([ADR-006](ADR-006-production-database-provider.md)), que expone PostgreSQL estándar: no hay capa de API de datos ni políticas RLS preconfiguradas que puedan activarse por accidente. Con independencia del proveedor, RLS **no se adopta** en el MVP como mecanismo de autorización: la autenticación y autorización principales viven en NestJS y el filtrado por `businessId` ocurre en la capa de aplicación. Si en el futuro se expone la base a un canal distinto de la API (BI, integraciones, Supabase Data API u otro), RLS deja de ser opcional y este ADR debe revisarse (§5).
