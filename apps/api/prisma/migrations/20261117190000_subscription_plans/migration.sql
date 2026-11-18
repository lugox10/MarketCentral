-- E4 · Planes con límites, suscripción con activación manual e historial inmutable.
--
-- Migración escrita a mano: en este entorno el schema-engine de Prisma no puede
-- arrancar (`spawn EPERM`), así que el DDL se aplica con `pg` y se registra en
-- `_prisma_migrations` con el checksum sha256 del archivo (ver docs/21 §6.4).
--
-- Prisma no modela CHECK ni triggers: se declaran aquí, igual que en E1–E3.

-- 1. Tipo del historial de activaciones ------------------------------------
CREATE TYPE "SubscriptionActivationKind" AS ENUM ('ACTIVATED', 'RENEWED', 'PLAN_CHANGED');

-- 2. Plan: columnas comerciales nuevas y retiro de la duración heredada -----
ALTER TABLE "plan" ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'COP';
ALTER TABLE "plan" ADD COLUMN "max_listings" SMALLINT;
ALTER TABLE "plan" ADD COLUMN "trial_months" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "plan" ADD COLUMN "billing_period_days" SMALLINT;

-- Valores comerciales aprobados (D-35): Free 10 / Base 30 / Pro 50.
UPDATE "plan" SET "max_listings" = 10, "trial_months" = 2 WHERE "code" = 'FREE';
UPDATE "plan" SET "max_listings" = 30, "billing_period_days" = 30 WHERE "code" = 'BASE';
UPDATE "plan" SET "max_listings" = 50, "billing_period_days" = 30 WHERE "code" = 'PRO';
-- Cualquier plan adicional preexistente conserva un límite mínimo explícito.
UPDATE "plan" SET "max_listings" = 10 WHERE "max_listings" IS NULL;

ALTER TABLE "plan" ALTER COLUMN "max_listings" SET NOT NULL;

-- Las restricciones heredadas hablaban de meses y días de prueba: ya no aplican.
ALTER TABLE "plan" DROP CONSTRAINT IF EXISTS "plan_interval_months_check";
ALTER TABLE "plan" DROP CONSTRAINT IF EXISTS "plan_trial_days_check";
ALTER TABLE "plan" DROP COLUMN "interval_months";
ALTER TABLE "plan" DROP COLUMN "trial_days";

-- `plan_price_cop_check` ya existe desde E2: no se duplica.
ALTER TABLE "plan" ADD CONSTRAINT "plan_currency_check" CHECK ("currency" = 'COP');
ALTER TABLE "plan" ADD CONSTRAINT "plan_max_listings_check" CHECK ("max_listings" > 0);
ALTER TABLE "plan" ADD CONSTRAINT "plan_trial_months_check"
  CHECK ("trial_months" >= 0 AND "trial_months" <= 12);
ALTER TABLE "plan" ADD CONSTRAINT "plan_billing_period_days_check"
  CHECK ("billing_period_days" IS NULL OR ("billing_period_days" >= 1 AND "billing_period_days" <= 366));

-- 3. Subscription: rastro de la última activación manual --------------------
ALTER TABLE "subscription" ADD COLUMN "activated_by_admin_id" UUID;
ALTER TABLE "subscription" ADD COLUMN "activation_note" VARCHAR(500);

ALTER TABLE "subscription" ADD CONSTRAINT "subscription_activated_by_admin_id_fkey"
  FOREIGN KEY ("activated_by_admin_id") REFERENCES "app_user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "subscription_current_period_end_idx" ON "subscription"("current_period_end");

-- `subscription_period_check` ya existe desde E2: no se duplica.
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_activation_note_check"
  CHECK ("activation_note" IS NULL OR char_length(btrim("activation_note")) BETWEEN 1 AND 500);

-- 4. Historial inmutable de activaciones ------------------------------------
CREATE TABLE "subscription_activation" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "subscription_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "activated_by_admin_id" UUID,
  "kind" "SubscriptionActivationKind" NOT NULL,
  "note" VARCHAR(500) NOT NULL,
  "activated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "period_start" TIMESTAMPTZ(6) NOT NULL,
  "previous_period_end" TIMESTAMPTZ(6),
  "new_period_end" TIMESTAMPTZ(6) NOT NULL,
  "price_cop" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'COP',
  "idempotency_key" VARCHAR(80),
  "request_hash" VARCHAR(64),

  CONSTRAINT "subscription_activation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_activation_idempotency_key_key"
  ON "subscription_activation"("idempotency_key");
CREATE INDEX "subscription_activation_subscription_id_activated_at_idx"
  ON "subscription_activation"("subscription_id", "activated_at");
CREATE INDEX "subscription_activation_plan_id_idx" ON "subscription_activation"("plan_id");

ALTER TABLE "subscription_activation" ADD CONSTRAINT "subscription_activation_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_activation" ADD CONSTRAINT "subscription_activation_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "plan"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_activation" ADD CONSTRAINT "subscription_activation_activated_by_admin_id_fkey"
  FOREIGN KEY ("activated_by_admin_id") REFERENCES "app_user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subscription_activation" ADD CONSTRAINT "subscription_activation_price_cop_check"
  CHECK ("price_cop" >= 0);
ALTER TABLE "subscription_activation" ADD CONSTRAINT "subscription_activation_currency_check"
  CHECK ("currency" = 'COP');
ALTER TABLE "subscription_activation" ADD CONSTRAINT "subscription_activation_note_check"
  CHECK (char_length(btrim("note")) BETWEEN 1 AND 500);
ALTER TABLE "subscription_activation" ADD CONSTRAINT "subscription_activation_period_check"
  CHECK ("new_period_end" > "period_start");

-- El historial no se edita: ni la aplicación ni un accidente de SQL pueden
-- reescribir una activación ya confirmada. El borrado solo ocurre por cascada
-- al eliminar la suscripción (no existe endpoint para eliminarla).
CREATE OR REPLACE FUNCTION "subscription_activation_block_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'subscription_activation es inmutable: UPDATE bloqueado';
END;
$$;

CREATE TRIGGER "subscription_activation_block_update_trg"
  BEFORE UPDATE ON "subscription_activation"
  FOR EACH ROW EXECUTE FUNCTION "subscription_activation_block_update"();
