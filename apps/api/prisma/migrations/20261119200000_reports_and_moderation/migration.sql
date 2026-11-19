-- E8 · Denuncias ciudadanas y auditoría de moderación.
--
-- `report` guarda la denuncia (puede ser anónima: solo se persiste el hash de la
-- IP). `moderation_action` es el rastro inmutable de lo que hizo cada
-- administrador: cambiar el estado de una denuncia, suspender un negocio o
-- archivar una publicación.

CREATE TYPE "ReportReason" AS ENUM ('SCAM', 'STOLEN', 'INAPPROPRIATE', 'WRONG_CATEGORY', 'OTHER');
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ModerationActionKind" AS ENUM (
  'REPORT_STATUS_CHANGED',
  'BUSINESS_SUSPENDED',
  'BUSINESS_REACTIVATED',
  'LISTING_ARCHIVED'
);

CREATE TABLE "report" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "reporter_user_id" UUID,
  "reporter_email" VARCHAR(320),
  "reporter_ip_hash" CHAR(64) NOT NULL,
  "business_id" UUID NOT NULL,
  "listing_id" UUID,
  "reason" "ReportReason" NOT NULL,
  "details" VARCHAR(2000),
  "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
  "resolved_by_admin_id" UUID,
  "resolution_note" VARCHAR(500),
  "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "report_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "report_ip_hash_check" CHECK ("reporter_ip_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "report_reporter_email_check" CHECK (
    "reporter_email" IS NULL
    OR ("reporter_email" = lower("reporter_email") AND "reporter_email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  CONSTRAINT "report_details_check" CHECK (
    "details" IS NULL OR char_length(btrim("details")) BETWEEN 10 AND 2000
  ),
  CONSTRAINT "report_resolution_note_check" CHECK (
    "resolution_note" IS NULL OR char_length(btrim("resolution_note")) BETWEEN 5 AND 500
  )
);

CREATE INDEX "report_status_created_at_idx" ON "report" ("status", "created_at");
CREATE INDEX "report_business_id_created_at_idx" ON "report" ("business_id", "created_at");
CREATE INDEX "report_listing_id_created_at_idx" ON "report" ("listing_id", "created_at");

ALTER TABLE "report"
  ADD CONSTRAINT "report_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id")
  REFERENCES "app_user" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report"
  ADD CONSTRAINT "report_resolved_by_admin_id_fkey" FOREIGN KEY ("resolved_by_admin_id")
  REFERENCES "app_user" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report"
  ADD CONSTRAINT "report_business_id_fkey" FOREIGN KEY ("business_id")
  REFERENCES "business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "report"
  ADD CONSTRAINT "report_listing_id_fkey" FOREIGN KEY ("listing_id")
  REFERENCES "listing" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "moderation_action" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "actor_user_id" UUID NOT NULL,
  "report_id" UUID,
  "business_id" UUID,
  "listing_id" UUID,
  "kind" "ModerationActionKind" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "moderation_action_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "moderation_action_reason_check" CHECK (
    char_length(btrim("reason")) BETWEEN 5 AND 500
  )
);

CREATE INDEX "moderation_action_created_at_idx" ON "moderation_action" ("created_at");
CREATE INDEX "moderation_action_business_id_created_at_idx" ON "moderation_action" ("business_id", "created_at");
CREATE INDEX "moderation_action_listing_id_created_at_idx" ON "moderation_action" ("listing_id", "created_at");
CREATE INDEX "moderation_action_report_id_idx" ON "moderation_action" ("report_id");

ALTER TABLE "moderation_action"
  ADD CONSTRAINT "moderation_action_actor_user_id_fkey" FOREIGN KEY ("actor_user_id")
  REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "moderation_action"
  ADD CONSTRAINT "moderation_action_report_id_fkey" FOREIGN KEY ("report_id")
  REFERENCES "report" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "moderation_action"
  ADD CONSTRAINT "moderation_action_business_id_fkey" FOREIGN KEY ("business_id")
  REFERENCES "business" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "moderation_action"
  ADD CONSTRAINT "moderation_action_listing_id_fkey" FOREIGN KEY ("listing_id")
  REFERENCES "listing" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
