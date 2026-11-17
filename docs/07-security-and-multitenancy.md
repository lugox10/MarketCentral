# 07 — Seguridad, autorización y multi-tenancy

**Estado:** documento para revisión · **Fecha:** 2026-11-12 · **Fase:** planificación (Prompt 01)

> Ningún control de esta sección se considera implementado. Este documento define **qué** debe cumplirse y **cómo se verificará**; la implementación y sus pruebas son trabajo posterior.

---

## 1. Principios

1. **El servidor no confía en identificadores de tenant enviados por el cliente.** El negocio se deriva de la sesión y la ruta, y se valida contra la membresía.
2. **Autorización en el backend, en cada caso de uso.** El frontend oculta acciones por usabilidad; nunca es un control de seguridad.
3. **Mínimo privilegio** en roles, en credenciales de base de datos y en tokens de storage.
4. **Defensa en profundidad**: aplicación + restricciones de base de datos + configuración de infraestructura; ninguna capa se asume suficiente sola.
5. **Fallo cerrado**: ante error de autorización, denegar; ante error de dependencia, no exponer datos.
6. **Trazabilidad de lo sensible** sin almacenar secretos ni PII innecesaria.

---

## 2. Superficie de amenaza (resumen)

| Activo | Amenaza principal | Control primario |
|--------|-------------------|------------------|
| Inventario y leads de un negocio | Acceso cruzado entre negocios (IDOR/BOLA) | `ActorContext` + scoping por `businessId` + pruebas negativas |
| Cuentas de usuario | Credential stuffing, fuerza bruta | Hash Argon2id, rate limiting, bloqueo progresivo, verificación de email |
| Sesiones | Robo de cookie, CSRF, fijación | Cookie HttpOnly/Secure/SameSite, token opaco hasheado, rotación, CSRF token |
| Panel de administración | Escalada de privilegios | Roles de plataforma separados, MFA obligatorio (propuesta), auditoría |
| Cobros de suscripción | Webhooks falsificados, replay | Firma HMAC, timestamp, idempotencia, verificación contra el proveedor |
| Archivos subidos | Malware, XSS almacenado, SSRF | Validación de MIME real, cuarentena, dominio separado, sin ejecución |
| Formularios públicos | Spam, flooding, scraping | Rate limit por IP/publicación, honeypot, captcha adaptativo (pendiente) |
| Datos personales | Exposición y uso indebido | Minimización, retención, cifrado en tránsito, control de acceso, DPA |

---

## 3. Roles: plataforma vs negocio

### 3.1 Roles de plataforma (globales)

| Rol | Propósito | No puede |
|-----|-----------|----------|
| `PLATFORM_ADMIN` | Configurar verticales, categorías, atributos, planes; gestionar usuarios de plataforma | Ver contenido de leads de negocios sin motivo registrado; editar publicaciones directamente |
| `MODERATOR` | Atender denuncias y aplicar decisiones **reactivas** (suspender negocio, archivar publicación) | Cambiar configuración de planes; gestionar roles de plataforma; revisar contenido antes de publicarse (no existe esa cola) |
| `SUPPORT` | Consultar estado de negocios y suscripciones para soporte | Decidir moderación; modificar datos de negocio |
| `FINANCE` | Registrar el cobro manual, activar/renovar suscripciones y conciliar | Editar publicaciones o negocios; activar sin nota de auditoría |

> **Cobro manual (Q-06, C-10):** la activación de una suscripción la ejecuta `FINANCE` o `PLATFORM_ADMIN` desde el panel de Admin, con `activationNote` obligatoria y registro en `Audit`. No hay roles ni permisos de pasarela en el MVP.

### 3.2 Roles de negocio (membresía)

| Rol | Propósito | Límite |
|-----|-----------|--------|
| `OWNER` | Control total del negocio | Debe haber al menos uno; no puede eliminarse a sí mismo si es el último |
| `ADMIN` | Gestión operativa y de miembros | No puede transferir la propiedad ni eliminar el negocio |
| `EDITOR` | Publicaciones, medios, leads | No gestiona miembros, suscripción ni verticales |
| `VIEWER` | Solo lectura del panel | No ejecuta acciones de escritura |

> **Alcance del MVP (Q-02, C-10):** cada negocio tiene **un único miembro**, el `OWNER`, que concentra todas las capacidades. `ADMIN`, `EDITOR` y `VIEWER` quedan **modelados pero no habilitados**: la tabla de miembros, la invitación y la matriz de abajo son el contrato para fase 2, no una funcionalidad del MVP. La verificación de "último `OWNER`" (`LAST_OWNER`) y las pruebas de rol se mantienen porque el modelo las admite.

### 3.3 Matriz de permisos (negocio)

| Capacidad | OWNER | ADMIN | EDITOR | VIEWER |
|-----------|:-----:|:-----:|:------:|:------:|
| Ver panel y métricas | ✅ | ✅ | ✅ | ✅ |
| Crear/editar publicaciones | ✅ | ✅ | ✅ | ❌ |
| Publicar/pausar/vender | ✅ | ✅ | ✅ | ❌ |
| Gestionar medios | ✅ | ✅ | ✅ | ❌ |
| Ver y gestionar leads | ✅ | ✅ | ✅ | ❌ |
| Invitar/revocar miembros | ✅ | ✅ | ❌ | ❌ |
| Cambiar roles (excepto owner) | ✅ | ✅ | ❌ | ❌ |
| Habilitar verticales | ✅ | ✅ | ❌ | ❌ |
| Contratar/cancelar suscripción | ✅ | ❌ | ❌ | ❌ |
| Editar perfil público | ✅ | ✅ | ❌ | ❌ |
| Cerrar el negocio | ✅ | ❌ | ❌ | ❌ |

**Regla de composición:** un usuario puede tener roles distintos en negocios distintos; los permisos **no** se suman entre negocios. El rol de plataforma **no** otorga permisos de negocio automáticamente (un `MODERATOR` no puede editar publicaciones como si fuera `EDITOR`; solo decidir moderación).

---

## 4. Autenticación

### 4.1 Contraseñas

- Hash con **Argon2id**, parámetros mínimos OWASP: `m=19456 KiB`, `t=2`, `p=1` (alternativa `m=47104`, `t=1`, `p=1`). Calibrar en el servidor de producción para que el hash tarde < 1 s.
- Longitud mínima 12 caracteres; máximo 128; sin composición obligatoria de clases; verificación contra listas de contraseñas comprometidas (k-anonymity con HIBP o lista local — **PROPUESTA**).
- Sin preguntas de seguridad. Sin pistas de contraseña.
- Rehash transparente al iniciar sesión si cambian los parámetros.
- Pepper opcional (secreto de aplicación) — **PENDIENTE**; si se adopta, debe rotarse con plan de migración.

### 4.2 Sesiones y cookies

- Sesión **server-side** con token opaco (≥ 256 bits) almacenado **hasheado** en base de datos. No se usa JWT de larga vida como sesión.
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, dominio de la API o del sitio según despliegue.
- Rotación del token al iniciar sesión y al cambiar contraseña o rol.
- Expiración absoluta 30 días; inactividad 7 días; revocación inmediata desde "sesiones activas".
- Logout invalida el registro de sesión, no solo la cookie.

### 4.3 CSRF

Con cookie de sesión, las peticiones mutantes desde el navegador requieren protección:

- **Estrategia propuesta:** token CSRF de doble envío (cookie legible `csrf` + header `X-CSRF-Token` validado contra el valor de sesión), más `SameSite=Lax` y verificación de `Origin`/`Referer` en peticiones mutantes.
- Excepción: webhooks y endpoints públicos de solo lectura (`GET`), que no usan cookie.
- Si en el futuro web y api quedan en sitios distintos, la cookie pasa a `SameSite=None; Secure` y el control CSRF se vuelve obligatorio sin excepciones.

### 4.4 Verificación de email y recuperación

- Registro → email de verificación con token de un uso, 24 h. Cuentas sin verificar tienen acceso limitado (pueden iniciar sesión pero no contratar ni invitar).
- Recuperación: token de un uso, 30 min, almacenado hasheado; respuesta **siempre genérica** (no revela si el email existe).
- Cambio de contraseña invalida todas las sesiones y notifica por correo.
- Bloqueo progresivo tras intentos fallidos por cuenta + IP (ver §9).

### 4.5 Autenticación multifactor

**PROPUESTA** para `PLATFORM_ADMIN` y `MODERATOR` en el MVP (TOTP), y opcional para owners. Requiere decisiones de UX y recuperación; si no se aprueba, el panel de plataforma debe restringirse por IP o VPN (PENDIENTE).

---

## 5. Autorización multi-tenant

### 5.1 Resolución del contexto

```
Petición → Sesión válida → User
        → Ruta con :businessId
        → Membership(userId, businessId) ACTIVE
        → Rol dentro del negocio
        → Recurso pertenece a businessId
        → Estado permite la operación
        → Permiso del rol permite la acción
```

Si cualquier paso falla: **404** si el recurso no existe o no pertenece al tenant (no revelar existencia), **403** si existe y pertenece pero el rol no alcanza. Esta distinción se aplica de forma consistente para no filtrar información por códigos de estado.

### 5.2 Reglas de implementación

- `ActorContext` se construye en un **guard/interceptor** y se inyecta en los casos de uso; los controladores no lo arman a mano.
- Todo repositorio privado recibe `businessId` como parámetro **obligatorio** (tipo no opcional) y lo incluye en el `where`.
- Prohibido: `findUnique({ where: { id } })` sin filtro de tenant en rutas privadas; prohibido aceptar `businessId` del body cuando ya está en la ruta.
- `PATCH`/`POST` usan DTO con lista blanca de campos; sin `...body` ni asignación masiva.
- Los servicios de aplicación **no** reciben `Request` de Express; reciben `ActorContext`.

### 5.3 Pruebas negativas obligatorias

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| N-01 | Usuario A (negocio 1) hace `GET /businesses/2/listings` | 404 |
| N-02 | Usuario A hace `PATCH /listings/{id de negocio 2}` | 404 |
| N-03 | Usuario A hace `DELETE /media/{id de negocio 2}` | 404 |
| N-04 | Usuario A lee `GET /businesses/2/leads` | 404 |
| N-05 | Usuario A envía `businessId: 2` en body de creación estando en ruta 1 | 400/404, nunca crea en 2 |
| N-06 | `EDITOR` intenta invitar miembro | 403 |
| N-07 | `VIEWER` intenta publicar | 403 |
| N-08 | Usuario sin membresía accede al panel | 404 |
| N-09 | Token de sesión revocado se reutiliza | 401 |
| N-10 | Petición mutante sin token CSRF | 403 |
| N-11 | `MODERATOR` intenta editar una publicación | 403 (solo decide) |
| N-12 | Consulta pública intenta `include=leads` | 400 (campo no permitido) |
| N-13 | Webhook con firma inválida | 401, sin efectos |
| N-14 | Webhook repetido | 200, un solo efecto |
| N-15 | Lead a publicación de otro tenant vía `businessId` falso | 404/422, sin registro |

Estas pruebas son **criterio de aceptación** de cada módulo privado, no una fase posterior.

---

## 6. RLS (Row Level Security) en PostgreSQL: evaluación

**No se adopta en el MVP.** Justificación:

| Aspecto | Evaluación |
|---------|-----------|
| Aporte | Defensa adicional si la aplicación tiene un fallo de scoping. |
| Con Prisma | Requiere `SET LOCAL app.current_business_id` por transacción o rol por tenant; con poolers en modo transacción y prepared statements desactivados añade fragilidad. |
| Complejidad | Políticas por tabla, migraciones que las versionan, pruebas específicas, riesgo de bloquear jobs internos (worker, admin). |
| Alternativas | Rol de BD de aplicación con permisos mínimos, repositorios con scoping obligatorio, pruebas negativas, revisión de código. |
| Cuándo revisar | Si se exponen datos a terceros, si hay inquilinos de alto valor, o si una auditoría lo exige. |

**Decisión:** `[PENDIENTE]` — reevaluar con la arquitectura de datos definitiva; por ahora se documenta como defensa **no** adoptada, con las alternativas anteriores como control compensatorio. Ver [ADR-003](decisions/ADR-003-multitenancy-strategy.md).

---

## 7. Validación de entradas y clases de ataque

| Clase | Control |
|-------|---------|
| Inyección SQL | Prisma con consultas parametrizadas; `$queryRaw` prohibido salvo revisión y parámetros vinculados. |
| XSS | Escape por defecto de React; `dangerouslySetInnerHTML` prohibido sin sanitización (si se permite HTML de negocio, sanitizar con lista blanca — **PENDIENTE**). |
| CSRF | §4.3. |
| IDOR/BOLA | §5; pruebas N-01…N-15. |
| Mass assignment | DTO con lista blanca; sin `Object.assign(entity, body)`. |
| SSRF | Sin URLs suministradas por usuarios hacia el backend; descarga de imágenes solo desde el bucket propio. |
| Open redirect | Sin parámetros `redirect` libres; destinos en lista blanca. |
| Path traversal | Nombres de archivo generados por el servidor; jamás rutas del usuario. |
| Fuerza bruta | Rate limit por IP + cuenta; backoff exponencial; bloqueo temporal. |
| Spam de formularios | Rate limit, honeypot, validación de contenido, captcha adaptativo **PENDIENTE**. |
| Enumeración de usuarios | Respuestas genéricas en login/recuperación/registro. |

---

## 8. Rate limiting y antiabuso

| Endpoint | Límite **PROPUESTA** | Ventana | Clave |
|----------|----------------------|---------|-------|
| `POST /auth/login` | 10 intentos | 15 min | IP + email |
| `POST /auth/register` | 5 | 1 h | IP |
| `POST /auth/forgot-password` | 3 | 1 h | IP + email |
| `POST /public/listings/:id/leads` | 5 | 10 min | IP + publicación |
| `GET /public/listings` | 120 | 1 min | IP |
| `POST /media/upload-url` | 30 | 1 h | usuario |
| Webhooks | 300 | 1 min | proveedor |

- Implementación: contador en memoria por instancia es insuficiente en producción multi-instancia; usar almacén compartido (Redis) o el rate limit del proxy. **PENDIENTE** de decisión de infraestructura.
- Respuesta `429` con `Retry-After` y cuerpo `problem+json`.
- Los límites son configurables por entorno; no se codifican en el frontend.

---

## 9. Secretos y entornos

- Secretos solo en variables de entorno del runtime o gestor de secretos del proveedor; **nunca** en el repositorio, en `NEXT_PUBLIC_*` ni en logs.
- `.env.example` con nombres y valores ficticios; `.env*` reales en `.gitignore`.
- Separación estricta de entornos: local, staging, producción con bases de datos, buckets y credenciales distintas.
- Rotación documentada para: credenciales de BD, claves de firma de webhooks, claves de storage, pepper (si se adopta).
- Acceso a producción restringido y auditado; sin credenciales compartidas por chat.
- El frontend solo recibe configuración pública (URLs, claves públicas de analítica si se aprueba).

---

## 10. Protección de datos personales (Colombia)

> No es asesoría jurídica. Requiere validación por abogado antes de producción ([12](12-risks-and-open-decisions.md), L-01).

- **Marco:** Ley 1581 de 2012 y decretos reglamentarios (1377 de 2013, 886 de 2014 para RNBD); autoridad de control: SIC — Delegatura para la Protección de Datos Personales.
- **Roles:** la plataforma actúa como **responsable** de los datos de usuarios y negocios, y como **encargada** de los datos de compradores que el negocio recibe vía Lead (esta calificación debe validarse).
- **Base legal y consentimiento:** los formularios de lead incluyen aviso de tratamiento y autorización expresa, informada y previa; se guarda versión del aviso y fecha.
- **Minimización:** el lead pide solo nombre, un medio de contacto y mensaje; no se solicitan documentos.
- **Retención (PROPUESTA):** leads 24 meses desde el último contacto; cuentas inactivas 36 meses; logs de auditoría 24 meses; registros de cobro según obligación contable (validar con contador).
- **Derechos del titular:** acceso, corrección, supresión y revocatoria; canal documentado y proceso con plazo (15 días hábiles para consultas, 15 para reclamos según la ley — validar).
- **Transferencia internacional:** si el proveedor de BD, storage o correo aloja datos fuera de Colombia, verificar declaración de conformidad y nivel adecuado; registrar en la documentación legal.
- **RNBD:** evaluar inscripción de bases de datos ante la SIC según tamaño y tipo.
- **Seguridad:** cifrado en tránsito (TLS obligatorio), cifrado en reposo según proveedor, control de acceso, registro de incidentes y plan de notificación de brechas.

---

## 11. Auditoría

Se audita (sin secretos ni contenido sensible completo):

- Inicio de sesión fallido/exitado, recuperación de contraseña, cambio de contraseña.
- Altas/bajas de membresías y cambios de rol.
- Decisiones de moderación (actor, objeto, motivo, resultado).
- Cambios de estado de suscripción y eventos de cobro.
- Acciones de `PLATFORM_ADMIN` sobre configuración (verticales, categorías, atributos, planes).
- Acceso de soporte a datos de un negocio (con motivo).

**Formato:** `actorId`, `actorRole`, `action`, `entityType`, `entityId`, `businessId`, `before/after` (solo campos relevantes), `ip`, `userAgent`, `occurredAt`, `requestId`. Retención según §10; consulta restringida a `PLATFORM_ADMIN` y `SUPPORT` con registro de la propia consulta.

---

## 12. Seguridad de webhooks

| Control | Implementación esperada |
|---------|-------------------------|
| Firma | HMAC-SHA256 sobre cuerpo crudo + timestamp, comparación en tiempo constante |
| Timestamp | Rechazo si `|now - ts| > 300 s` (anti-replay) |
| Idempotencia | `providerEventId` único; segundo procesamiento responde 200 sin efectos |
| Orden | El estado se calcula por tipo + fechas del proveedor; discrepancias se registran |
| Verificación adicional | Consulta al proveedor del objeto referenciado cuando el evento lo permita |
| Aislamiento | Endpoint sin sesión, sin CSRF, con rate limit propio, cuerpo máximo acotado |
| Secretos | Clave por proveedor y por entorno, rotable |
| Respuesta | 2xx rápido (< 2 s); procesamiento pesado asíncrono |

**Nunca** se confía en el payload para fijar montos, planes o fechas: se contrasta con la API del proveedor.

---

## 13. Seguridad de archivos

- Carga directa firmada; la API no acepta binarios en producción.
- Validación de **MIME real** por firma de bytes, no por extensión ni por `Content-Type` del cliente.
- Formatos permitidos: JPEG, PNG, WebP. SVG **prohibido** (XSS).
- Límite por archivo (5 MB — **PROPUESTA**), máximo de imágenes por publicación (10 — **PROPUESTA**).
- Dimensiones mínimas (800×600) y máximas; recompresión y eliminación de EXIF (incluye GPS) al procesar.
- Nombres generados por el servidor (`uuid.ext`); sin nombres originales en la URL.
- Bucket privado por defecto; entrega por CDN con URLs firmadas de corta duración o bucket público **solo** de medios procesados; nunca se sirve el bucket de cuarentena.
- Eliminación: al borrar la publicación, job de limpieza de objetos huérfanos; los borrados son lógicos en BD y físicos en storage de forma asíncrona.
- Cuarentena y análisis: si se aprueba antivirus, se ejecuta antes de publicar; si no, se documenta el riesgo aceptado.

---

## 14. Checklist de verificación previa a producción

- [ ] Pruebas N-01…N-15 en verde y automatizadas.
- [ ] Todas las rutas privadas exigen sesión y membresía.
- [ ] Cookies con `HttpOnly`, `Secure`, `SameSite`; CSRF activo.
- [ ] Rate limits configurados en todos los endpoints públicos.
- [ ] Argon2id calibrado; sin contraseñas en logs.
- [ ] Webhooks con firma, timestamp e idempotencia probados.
- [ ] Bucket sin listado público; MIME real validado; SVG rechazado.
- [ ] Roles de plataforma separados y auditados; MFA o restricción de red decidida.
- [ ] Secretos fuera del repositorio; entornos separados.
- [ ] Aviso de privacidad, política de tratamiento y proceso de derechos publicado.
- [ ] Plan de respuesta a incidentes y contactos definidos.
- [ ] Revisión legal y contable completada o riesgos aceptados por escrito.
