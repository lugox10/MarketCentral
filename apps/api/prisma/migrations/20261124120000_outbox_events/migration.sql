-- E10 · Transactional outbox.
-- La tabla vive en la misma base que el negocio: el INSERT del evento ocurre en
-- la misma transacción que el cambio, así que nunca queda un evento sin hecho
-- ni un hecho sin evento.

CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

CREATE TABLE "outbox_event" (
  "id"           UUID         NOT NULL DEFAULT uuidv7(),
  "event_type"   VARCHAR(80)  NOT NULL,
  "payload"      JSONB        NOT NULL,
  "status"       "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "dedupe_key"   VARCHAR(120),
  "attempts"     SMALLINT     NOT NULL DEFAULT 0,
  "last_error"   VARCHAR(500),
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "outbox_event_event_type_check"
    CHECK ("event_type" ~ '^[A-Z][A-Za-z]{2,79}$'),
  CONSTRAINT "outbox_event_payload_check"
    CHECK (jsonb_typeof("payload") = 'object'),
  CONSTRAINT "outbox_event_attempts_check"
    CHECK ("attempts" >= 0 AND "attempts" <= 100),
  CONSTRAINT "outbox_event_processed_check"
    CHECK (("status" = 'PROCESSED') = ("processed_at" IS NOT NULL))
);

-- Un evento por hecho: la clave de deduplicación evita duplicados si el mismo
-- caso de uso se reintenta antes de confirmar la transacción.
CREATE UNIQUE INDEX "outbox_event_dedupe_key_key" ON "outbox_event" ("dedupe_key");

-- Cola: los pendientes listos para procesar, en orden de llegada.
CREATE INDEX "outbox_event_status_available_at_idx"
  ON "outbox_event" ("status", "available_at");
CREATE INDEX "outbox_event_event_type_created_at_idx"
  ON "outbox_event" ("event_type", "created_at");
