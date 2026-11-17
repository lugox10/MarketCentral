# 24 — Política de datos de desarrollo, seed y producción

**Estado:** APROBADA (política dada por el cliente) · **Fecha:** 2026-11-17
**Aplica a:** E4 y a todas las épicas posteriores hasta el primer despliegue productivo.
**Naturaleza:** este documento no describe código existente; fija una regla de trabajo y el procedimiento de inicialización productiva.

---

## 1. Hechos verificados (2026-11-17)

Consultas de solo lectura contra las bases locales (`marketcentral_dev` y `marketcentral_test`) y contra el repositorio:

| Comprobación | Resultado |
|---|---|
| Negocios en `marketcentral_dev` | **0** |
| Suscripciones en `marketcentral_dev` | **0** |
| Planes en `marketcentral_dev` | 3 (`FREE` 0 COP, `BASE` 30.000, `PRO` 50.000) |
| Negocios en `marketcentral_test` | 5, todos con suscripción `TRIALING` (datos de prueba, desechables) |
| Tablas de auditoría existentes | **ninguna** (`information_schema` no devuelve `%audit%`) |
| Repositorio Git | **no existe** (`fatal: not a git repository`) |

Conclusión: **no hay un solo negocio real ni histórico productivo que preservar**. Un backfill de suscripciones no tendría sobre qué operar y no se justifica.

---

## 2. Reglas

1. No se desarrollan migraciones de datos para asignar suscripciones a negocios de prueba existentes.
2. No se inventan fechas de inicio ni vencimientos retroactivos.
3. No se crean suscripciones durante una consulta `GET` (ni de forma perezosa, ni como efecto secundario de leer un negocio).
4. El aprovisionamiento del plan Free se integra **exclusivamente** con el flujo de creación de negocio de E2 (`CreateBusinessUseCase`), en la misma transacción que crea `business` y `business_membership`.
5. El seed se mantiene **idempotente** para los datos de referencia.
6. Los datos de referencia y los datos demostrativos se separan (ver §3).
7. Los datos demostrativos **no se ejecutan en producción**.
8. No se incorporan credenciales de usuarios de prueba en producción.
9. No se eliminan datos de la base local durante la implementación de E4.
10. No se ejecutan `migrate reset`, `db push --force-reset` ni operaciones destructivas sin autorización explícita.

---

## 3. Datos de referencia vs. datos demostrativos

Hoy `apps/api/prisma/seed.ts` mezcla tres cosas en una sola ejecución:

| Contenido actual del seed | Clasificación | ¿Va a producción? |
|---|---|---|
| Admin `admin@marketcentral.com` con contraseña fija `Admin123!` | **Demostrativo** | **No** |
| Planes `FREE`, `BASE`, `PRO` | **Referencia** | Sí |
| Taxonomía `Prenderías` → `Celulares` / `Computadores` → atributos | **Referencia** | Sí (es la configuración inicial de la vertical) |

Propuesta de separación (se implementará cuando el despliegue lo exija, no en E4 salvo que se apruebe):

- `prisma/seed.ts` → **solo referencia**: planes y taxonomía. Idempotente, sin usuarios.
- `prisma/seed-demo.ts` → **solo demostración**: admin de prueba, negocios de ejemplo, publicaciones. Exige `NODE_ENV !== 'production'` y aborta en caso contrario.

Consecuencia inmediata: el primer `SUPER_ADMIN` de producción **no** puede venir de un seed con contraseña en el repositorio (regla 8). Ver §5.

---

## 4. Alcance de E4 respecto a datos

Durante E4 solo se debe garantizar:

- Existencia de `FREE`, `BASE` y `PRO`.
- Persistencia de precios y límites.
- Asignación automática de `FREE` a negocios nuevos.
- Prueba gratuita de dos meses calendario.
- Activación manual de planes pagados.
- Historial de activaciones y renovaciones.

No forma parte de E4: backfill, limpieza de datos ficticios, migración de negocios de demostración ni campañas de saneamiento.

---

## 5. Procedimiento de inicialización productiva

1. **Aprovisionar** PostgreSQL (proveedor aprobado en ADR-006: Neon Free en `aws-sa-east-1`, o el que lo sustituya).
2. **Ejecutar migraciones versionadas** con `prisma migrate deploy` (nunca `migrate dev` ni `db push`).
3. **Ejecutar exclusivamente el seed de referencia** (planes + taxonomía).
4. **Configurar el primer `SUPER_ADMIN` mediante un proceso seguro.** Opciones evaluadas:

   | Opción | Cómo | Riesgo |
   |---|---|---|
   | A (recomendada) | Script de un solo uso que lee `ADMIN_EMAIL` y `ADMIN_INITIAL_PASSWORD` de variables de entorno efímeras, crea el usuario y **obliga a cambio de contraseña** en el primer inicio de sesión | Requiere implementar el flag de cambio obligatorio |
   | B | Crear el usuario por consola SQL con un hash Argon2id generado localmente | Error humano; el hash queda en el historial de la shell |
   | C | Invitación por correo con token de un solo uso | Necesita proveedor de correo (D-21, aún pendiente) |

   En las tres: contraseña distinta por entorno, never en Git, y rotación inmediata tras el alta.

5. **Verificar integridad**: conteo de tablas esperadas, `_prisma_migrations` con las migraciones aplicadas, `plan` con 3 filas, `vertical` con la vertical inicial, FK activas.
6. **Habilitar el registro de negocios reales.**

No se ejecuta el seed de demostración en producción. No se reutilizan credenciales de desarrollo.

---

## 6. Riesgos y decisiones abiertas de esta política

| ID | Tema | Estado |
|---|---|---|
| D-31 | Negocio sin suscripción en producción | **APROBADA 2026-11-17**: bloquear su panel y asignar Free manual y auditado; nunca automático en `GET`; sin backfill |
| D-32 | Mecanismo exacto para el primer `SUPER_ADMIN` productivo (A/B/C de §5) y si se implementa el cambio de contraseña obligatorio | PENDIENTE — decidir antes del primer despliegue |
| D-33 | Separar `seed-demo.ts` del seed de referencia, y en qué épica se hace | PROPUESTA — no bloquea E4 |
| D-34 | El seed actual sobrescribe nombre y precio de los planes (`update` en el `upsert`). En producción, un cambio de precio hecho a mano se perdería al re-ejecutar el seed | PENDIENTE — decidir si el seed de referencia solo crea (`create`) o actualiza |

Nota sobre D-34: hoy el `upsert` de planes actualiza `name`, `priceCop`, `intervalMonths` y `trialDays`. En E4 esas dos últimas columnas pasan a `trialMonths` y `billingPeriodDays` (más `maxListings`, D-35 aprobada), y el `upsert` deberá escribir los campos nuevos. Sigue siendo correcto para desarrollo; en producción conviene que el seed sea **solo de creación** y que los precios se administren por panel administrativo.
