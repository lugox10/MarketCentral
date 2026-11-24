# 28 · Runbook de operación (E9)

Documento operativo del MVP: correo saliente, observabilidad, copias de
seguridad y prueba de extremo a extremo. No sustituye al plan de despliegue,
que depende de decisiones aún PENDIENTES (proveedor de base de datos, proveedor
de almacenamiento y plataforma de despliegue).

## 1. Correo saliente

`MAIL_SENDER` se resuelve en `apps/api/src/modules/auth/auth.module.ts`:

- **Sin `RESEND_API_KEY`** → `ConsoleMailSender`. Imprime el correo en el log y
  guarda el último asunto en memoria. Es el modo de desarrollo y de pruebas.
- **Con `RESEND_API_KEY`** → `ResendMailSender`, que llama a
  `https://api.resend.com/emails` con `fetch` nativo (sin SDK ni dependencias).

Variables:

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `RESEND_API_KEY` | En producción | Autenticación con Resend |
| `MAIL_FROM` | Recomendada | Remitente verificado (SPF/DKIM) |
| `MAIL_REPLY_TO` | Opcional | Buzón de respuestas |
| `NEXT_PUBLIC_SITE_URL` | Recomendada | Enlaces del correo (verificación, reset) |

Correos cubiertos: verificación de cuenta, recuperación de contraseña, aviso de
vencimiento de suscripción y aviso de nuevo contacto (lead). El envío del lead
es **best-effort**: si el proveedor falla, el lead ya está guardado y el error
solo se registra.

Los logs de correo usan `maskEmail` (primeras dos letras + dominio) y nunca
incluyen el contenido del mensaje ni la clave del proveedor.

## 2. Observabilidad

- **Log de peticiones** (`apps/api/src/common/observability/request-logger.middleware.ts`):
  una línea JSON por petición con `event`, `requestId`, `method`, `path`,
  `status` y `durationMs`. Se omiten `/media`, `/favicon.ico` y `/_next`.
  Nunca se registran cuerpo, query, cabeceras ni cookies.
- **`X-Request-Id`**: se devuelve en la respuesta y aparece en el log; úsalo
  para correlacionar un reporte de error con su traza.
- **Errores 500** (`internal-error.filter.ts`): registra `cause` y las ocho
  primeras líneas del stack, y responde un mensaje genérico con `requestId`
  (sin detalles internos). Las `HttpException` conservan su contrato habitual.
- **Lectura**: en local, `pnpm dev` escribe en la consola. En un despliegue,
  redirige stdout al colector del proveedor; el formato JSON ya es compatible
  con agregadores sin parseo adicional.

## 3. Copias de seguridad

`scripts/backup.js` genera un dump en formato custom de PostgreSQL, su hash y
aplica retención.

```bash
# Comprobar configuración sin escribir nada
node scripts/backup.js --dry-run

# Backup a la carpeta por defecto (.var/backups), retención 14 días
node scripts/backup.js

# Opciones
node scripts/backup.js --out=D:/backups --keep=30
node scripts/backup.js --url=postgresql://usuario:clave@host:5432/db
```

- Requiere `pg_dump` en el PATH (client tools de PostgreSQL 18). Sin él, el
  script lo explica y sugiere `docker run --rm postgres:18 pg_dump`.
- La `DATABASE_URL` se resuelve del entorno, de `.env` o de `--url`. En los
  logs aparece redactada (`***`), nunca la contraseña.
- Cada backup produce `marketcentral-YYYYMMDD-HHmmss.dump` y su `.sha256`.
  Verifica con `sha256sum -c <archivo>.dump.sha256`.
- Restaurar: `pg_restore --clean --if-exists --no-owner -d <destino> <archivo>`.
- Los dumps locales son el paso previo a subirlos a almacenamiento de objetos;
  el destino en la nube sigue PENDIENTE (misma decisión que las imágenes).

## 4. Prueba E2E

`apps/api/test/e2e-marketplace.spec.ts` recorre el flujo completo con supertest
sobre la app real y la base de pruebas:

1. El dueño se registra, inicia sesión, crea su negocio y publica un artículo
   con imagen.
2. El comprador lo encuentra en el catálogo público y abre el detalle (sin
   datos privados).
3. El comprador envía el formulario de contacto y queda un lead.
4. El dueño ve el contacto en su bandeja, lo abre y lo marca como respondido.
5. El admin ve negocios, suscripciones, contactos y taxonomía, y el dueño
   recibe 403 en las rutas de administración.

Se ejecuta con el resto de la suite (`pnpm --filter @marketcentral/api test`).
Playwright no se usa: el sandbox no puede lanzar navegadores (`spawn EPERM`).

## 5. Pendientes de operación

- Proveedor de correo definitivo y autenticación del dominio (D-21).
- Destino de los backups (S3/R2) y política de restauración probada.
- Alertas sobre `http_error` y sobre fallos de correo.
- Rotación de `FORM_TOKEN_SECRET` e `IP_HASH_SECRET`.
