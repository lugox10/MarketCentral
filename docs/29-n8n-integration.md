# 29 · Integración futura con n8n (outbox)

Estado: **preparado, no conectado**. n8n no se instala en esta etapa. Este
documento describe el contrato que ya existe y las dos formas de conectar un
consumidor externo cuando se decida.

## 1. Qué hay hoy

- Tabla `outbox_event` con `event_type`, `payload` JSONB, `status`
  (`PENDING`/`PROCESSED`/`FAILED`), `dedupe_key`, `attempts`, `last_error`,
  `available_at`, `created_at` y `processed_at`.
- `OutboxService.enqueue(tx, { type, payload, dedupeId })` publica **dentro de
  la transacción** que cambia el negocio. Si la transacción se revierte, el
  evento desaparece con ella.
- Un proceso en background (`OutboxProcessor`, cron cada 30 s) toma los
  pendientes, los "entrega" (hoy: línea de log `outbox_event_processed`) y los
  marca `PROCESSED`. Los fallos reintentan con backoff exponencial
  (1, 2, 4… minutos, tope 1 hora) hasta 8 intentos; después quedan `FAILED`
  con el mensaje en `last_error`.

Eventos publicados:

| Evento | Cuándo | Payload (sin datos personales) |
| --- | --- | --- |
| `LeadCreated` | Un comprador envía el formulario | `leadId`, `businessId`, `listingId`, `source`, `createdAt` |
| `BusinessRegistered` | Se crea un negocio | `businessId`, `businessSlug`, `verticalId`, `city`, `flaggedForReview`, `createdAt` |
| `SubscriptionActivated` | El admin activa un plan | `subscriptionId`, `activationId`, `businessId`, `planCode`, `kind`, `status`, `priceCop`, `currentPeriodEnd` |
| `ReportCreated` | Se denuncia una publicación | `reportId`, `businessId`, `listingId`, `reason`, `status`, `createdAt` |

El payload no lleva correo, teléfono ni nombre del comprador: un consumidor que
necesite el detalle debe consultarlo por una API autenticada.

## 2. Por qué outbox y no un `emit` directo

Si el proceso muere justo después del `COMMIT` y antes del `POST` al webhook, un
`emit` en memoria pierde el evento para siempre. Con outbox el hecho y el evento
se confirman juntos, y el envío se puede reintentar sin duplicar el hecho. La
clave `dedupe_key` (`EventType:id`) evita encolar dos veces el mismo hecho si un
caso de uso se reintenta.

## 3. Opción A — webhook saliente (recomendada)

n8n expone un *Webhook node* con una URL propia. El transporte se implementa en
`OutboxProcessor.deliver`, que es el único punto a cambiar:

1. `POST` a `N8N_WEBHOOK_URL` con `Content-Type: application/json`.
2. Cuerpo: `{ id, type, occurredAt, payload }` (el `id` de la fila sirve como
   clave de idempotencia en n8n).
3. Cabecera `X-MarketCentral-Signature: sha256=<hmac>` calculada con
   `OUTBOX_WEBHOOK_SECRET` sobre el cuerpo crudo, para que n8n pueda verificar
   que el evento viene de la plataforma.
4. Timeout corto (5–10 s) y `throw` ante `5xx`/timeout para que el reintento con
   backoff haga su trabajo. Un `4xx` (salvo 408/429) significa contrato roto:
   conviene marcar `FAILED` sin reintentar.

Ventaja: el estado vive en la tabla, hay reintentos y el orden por
`available_at`/`created_at` es razonable. No requiere exponer nada público.

## 4. Opción B — endpoint de lectura `GET /webhooks/events`

n8n hace *polling* cada minuto. Si se implementa, debe ser solo para
administración y no para el público:

- `GET /admin/outbox/events?status=PENDING&limit=50`, protegido con
  `SessionGuard` + `RolesGuard` y `@Roles('SUPER_ADMIN')` (o un token de servicio
  dedicado, nunca una cookie de navegador).
- Devuelve los eventos ordenados por `createdAt`, sin datos personales (igual
  que hoy).
- **No** debe marcar `PROCESSED`: eso lo decide el consumidor con un segundo
  `POST /admin/outbox/events/:id/ack`. Si el *ack* no llega, el evento sigue
  pendiente y se reintenta; es la diferencia entre "leído" y "procesado".
- Paginación por cursor (`createdAt`, `id`) para no perder eventos si entran
  mientras se pagina.

Ventaja: no hay que abrir la red de la plataforma hacia n8n. Desventaja: más
peticiones y una ventana de duplicado si el *ack* se pierde (n8n debe
deduplicar por `id`).

## 5. Contrato de ejemplo

```json
{
  "id": "0192f0c4-8f0a-7c31-9b3e-6f1f3a2d9c11",
  "type": "LeadCreated",
  "occurredAt": "2026-11-24T15:04:05.123Z",
  "payload": {
    "leadId": "0192f0c4-8f0a-7c31-9b3e-6f1f3a2d9c12",
    "businessId": "0192f0c4-8f0a-7c31-9b3e-6f1f3a2d9c13",
    "listingId": "0192f0c4-8f0a-7c31-9b3e-6f1f3a2d9c14",
    "source": "LISTING",
    "createdAt": "2026-11-24T15:04:05.100Z"
  }
}
```

Versionado: si un evento cambia de forma, se añade un campo nuevo y se mantiene
el anterior; un cambio incompatible se publica como `LeadCreatedV2` en lugar de
mutar el existente.

## 6. Operación

- Variables previstas: `N8N_WEBHOOK_URL`, `OUTBOX_WEBHOOK_SECRET`,
  `OUTBOX_ENABLED` (para apagar el drenaje en mantenimiento).
- Monitorización mínima: contar `FAILED` y la antigüedad del `PENDING` más
  viejo. Hoy se consulta con SQL:
  `SELECT status, count(*) FROM outbox_event GROUP BY status;` y
  `SELECT min(created_at) FROM outbox_event WHERE status = 'PENDING';`
- Retención: los `PROCESSED` se pueden borrar pasados 90 días; los `FAILED` se
  revisan antes de borrar.
- El drenaje corre en el mismo proceso que la API (ADR-001). Con varias
  réplicas, cada una drenará su parte; si eso molesta, hay que mover el proceso
  a un worker o tomar un lock de base (`pg_try_advisory_lock`).

## 7. Lo que falta para conectarlo de verdad

1. Decidir Opción A u B y crear el flujo en n8n.
2. Implementar `deliver` (A) o los endpoints de lectura/ack (B) con pruebas.
3. Definir el secreto y rotarlo.
4. Añadir alerta cuando haya `FAILED` o pendientes de más de 15 minutos.
