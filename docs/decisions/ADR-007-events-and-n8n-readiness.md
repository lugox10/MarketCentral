# ADR-007 — Eventos de dominio y preparación para n8n

| Campo | Valor |
|-------|-------|
| **Estado** | **PROPUESTA** (outbox y contrato de eventos) · Principio "n8n no es dependencia": **APROBADA** |
| **Fecha** | 2026-11-12 |
| **Decisor** | Responsable del proyecto (Prompt 01) |
| **Ámbito** | Integraciones, consistencia de eventos, automatización futura |
| **Relacionados** | [09](../09-integrations-and-n8n-readiness.md), [06 §14](../06-core-flows-and-state-machines.md), [05](../05-modules-and-responsibilities.md) |

---

## 1. Contexto

Se prevé automatizar comunicaciones y seguimiento con n8n en una fase posterior. La plataforma debe poder emitir eventos confiables sin que su lógica de negocio dependa de n8n, y sin perder eventos cuando un consumidor externo esté caído.

También hay efectos internos que deben ser confiables: notificar un lead, invalidar caché, recalcular entitlements.

## 2. Alternativas

| Alternativa | Descripción | Evaluación |
|-------------|-------------|------------|
| **A. Outbox transaccional + publicador (elegida)** | El evento se escribe en la misma transacción del cambio; un worker lo publica | Garantiza "al menos una vez" sin 2PC; reintentos e idempotencia |
| B. Publicar directo a un broker (Kafka, RabbitMQ) | Envío inmediato | Requiere broker en el MVP; riesgo de evento perdido si falla el commit o el broker |
| C. Llamadas HTTP síncronas a n8n desde el caso de uso | n8n como dependencia | Acopla el dominio, rompe si n8n cae; rechazada |
| D. Triggers de base de datos | `LISTEN/NOTIFY` o triggers | Frágil, difícil de versionar y de observar; rechazada |
| E. Sin eventos (solo polling) | n8n consulta la API periódicamente | Simple pero con latencia y carga; no cubre notificaciones internas |

## 3. Decisión

1. **Outbox transaccional** en PostgreSQL: cada caso de uso escribe el cambio de estado y el evento en la **misma transacción**.
2. Un **worker** publica los eventos pendientes con `FOR UPDATE SKIP LOCKED`, reintentos con backoff y dead-letter.
3. **Eventos de dominio con envelope versionado** (`eventId`, `eventType`, `eventVersion`, `occurredAt`, `aggregateId`, `businessId`, `correlationId`, `payload`).
4. Los eventos llevan **identificadores, no PII**; quien necesite el detalle lo consulta con autorización.
5. **n8n es un consumidor futuro**: recibe webhooks firmados o consulta la API con credenciales de servicio. El dominio **no** conoce n8n, sus nodos ni sus formatos.
6. En el MVP no se despliega n8n ni se implementan webhooks salientes: solo la tabla de outbox, el contrato y los consumidores internos.
7. La plataforma debe funcionar correctamente con n8n desconectado: los eventos se acumulan y se reintentan; nada del flujo principal se bloquea.

## 4. Consecuencias

**Positivas**

- Consistencia entre dato y evento sin transacciones distribuidas.
- Base sólida para notificaciones internas y automatizaciones futuras.
- Reintentos y trazabilidad por `eventId`/`correlationId`.
- Desacoplamiento real: n8n se puede encender, apagar o reemplazar.

**Negativas**

- Una tabla más y un worker que operar y monitorear.
- Entrega "al menos una vez": todos los consumidores deben ser idempotentes.
- El orden entre agregados no está garantizado; los consumidores no deben asumirlo.
- Crecimiento de la tabla: requiere limpieza/archivado.

**Mitigaciones**

- Consumidores idempotentes por `eventId`.
- Métricas de backlog y dead-letter con alertas ([09 §10](../09-integrations-and-n8n-readiness.md)).
- Retención y archivado definidos (90 días en tabla — **PROPUESTA**).
- Contrato congelado en v1 antes de conectar n8n.

## 5. Webhooks salientes (fase 2)

- Firma HMAC-SHA256 con timestamp; ventana anti-replay de 300 s.
- `X-MC-Event-Id` para idempotencia en el receptor.
- Reintentos con backoff hasta 24 h; dead-letter visible.
- Solo `https`, sin destinos privados (anti-SSRF).
- Nunca se envían secretos, tokens, datos de pago ni contenido de mensajes de leads.

## 6. Criterios para aprobar la implementación del outbox en el MVP

1. El contrato de eventos v1 está revisado y congelado.
2. Existe al menos un consumidor interno real (notificación de lead o invalidación de caché) que lo justifique.
3. El worker tiene métricas, alertas y runbook.
4. Se definió la retención y el archivado.
5. Las pruebas cubren: fallo entre commit y publicación, reintento, duplicado y dead-letter.

## 7. Criterios para habilitar n8n (fase 2)

1. MVP en producción con métricas estables.
2. Credenciales de servicio con permisos mínimos y auditoría.
3. Contrato de webhooks probado con un receptor de prueba.
4. Validación legal del envío de datos a terceros.
5. Aprobación explícita de costo y operación.

## 8. Lo que este ADR NO autoriza

- No autoriza desplegar n8n.
- No autoriza que un caso de uso llame a n8n de forma síncrona.
- No autoriza incluir datos personales en eventos.
- No autoriza exponer la base de datos a herramientas de automatización.
