-- E5 · fase 1: negocio por vertical, cupos de plan y aviso de vencimiento (D-40, D-41).
-- Requiere que exista la vertical `prenderias` para los negocios históricos.

ALTER TYPE "SubscriptionActivationKind" ADD VALUE IF NOT EXISTS 'TRIAL_ADJUSTED';

-- ---------------------------------------------------------------------------
-- plan: cupos de categorías propias y destacados, prueba en días
-- ---------------------------------------------------------------------------
ALTER TABLE "plan"
  ADD COLUMN "max_categories" SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN "featured_slots" SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN "trial_days" SMALLINT;

UPDATE "plan" SET "max_categories" = 0, "featured_slots" = 3 WHERE "code" = 'FREE';
UPDATE "plan" SET "max_categories" = 3, "featured_slots" = 6 WHERE "code" = 'BASE';
UPDATE "plan" SET "max_categories" = 5, "featured_slots" = 10 WHERE "code" = 'PRO';

ALTER TABLE "plan"
  ADD CONSTRAINT "plan_max_categories_check" CHECK ("max_categories" >= 0),
  ADD CONSTRAINT "plan_featured_slots_check" CHECK ("featured_slots" >= 0),
  ADD CONSTRAINT "plan_trial_days_check" CHECK (
    "trial_days" IS NULL OR ("trial_days" >= 0 AND "trial_days" <= 90)
  );

-- ---------------------------------------------------------------------------
-- business: vertical, dueño, huella y bandera de revisión
-- ---------------------------------------------------------------------------
ALTER TABLE "business"
  ADD COLUMN "vertical_id" UUID,
  ADD COLUMN "owner_user_id" UUID,
  ADD COLUMN "fingerprint" VARCHAR(200),
  ADD COLUMN "flagged_for_review" BOOLEAN NOT NULL DEFAULT false;

UPDATE "business" b
SET "owner_user_id" = m."user_id"
FROM "business_membership" m
WHERE m."business_id" = b."id"
  AND m."role" = 'OWNER'
  AND b."owner_user_id" IS NULL;

UPDATE "business"
SET "vertical_id" = (SELECT "id" FROM "vertical" WHERE "slug" = 'prenderias')
WHERE "vertical_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "business" WHERE "vertical_id" IS NULL) THEN
    RAISE EXCEPTION 'E5: falta la vertical prenderias o hay negocios sin vertical asignable';
  END IF;
  IF EXISTS (SELECT 1 FROM "business" WHERE "owner_user_id" IS NULL) THEN
    RAISE EXCEPTION 'E5: hay negocios sin membresía OWNER; corrígelos antes de migrar';
  END IF;
END $$;

UPDATE "business"
SET "fingerprint" = lower(
  regexp_replace(
    "name" || '|' || COALESCE("address_line", ''),
    '\s+',
    ' ',
    'g'
  )
)
WHERE "fingerprint" IS NULL;

ALTER TABLE "business"
  ALTER COLUMN "vertical_id" SET NOT NULL,
  ALTER COLUMN "owner_user_id" SET NOT NULL,
  ALTER COLUMN "fingerprint" SET NOT NULL,
  ALTER COLUMN "address_line" SET NOT NULL;

ALTER TABLE "business"
  ADD CONSTRAINT "business_vertical_id_fkey"
    FOREIGN KEY ("vertical_id") REFERENCES "vertical"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "business_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "business_vertical_id_owner_user_id_key"
  ON "business"("vertical_id", "owner_user_id");
CREATE UNIQUE INDEX "business_vertical_id_whatsapp_e164_key"
  ON "business"("vertical_id", "whatsapp_e164");
CREATE UNIQUE INDEX "business_vertical_id_fingerprint_key"
  ON "business"("vertical_id", "fingerprint");
CREATE INDEX "business_owner_user_id_idx" ON "business"("owner_user_id");

-- ---------------------------------------------------------------------------
-- category: categorías propias por negocio (E5 fase 2)
-- ---------------------------------------------------------------------------
ALTER TABLE "category"
  ADD COLUMN "business_id" UUID,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "category" DROP CONSTRAINT IF EXISTS "category_vertical_id_slug_key";

CREATE UNIQUE INDEX "category_global_vertical_slug_key"
  ON "category"("vertical_id", "slug") WHERE "business_id" IS NULL;
CREATE UNIQUE INDEX "category_business_vertical_slug_key"
  ON "category"("vertical_id", "business_id", "slug") WHERE "business_id" IS NOT NULL;
CREATE INDEX "category_business_id_idx" ON "category"("business_id");

ALTER TABLE "category"
  ADD CONSTRAINT "category_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- subscription: aviso diario de vencimiento
-- ---------------------------------------------------------------------------
ALTER TABLE "subscription" ADD COLUMN "expiry_notified_on" DATE;
