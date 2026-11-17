-- E2: negocios, membresías, planes y suscripciones.
-- DDL equivalente al que generaría `prisma migrate dev` para el esquema de
-- docs/15 §2 y docs/16 §2, §6. Se escribe a mano porque el motor de migraciones
-- (`schema-engine-windows.exe`) no puede ejecutarse en el entorno del agente
-- (ver docs/21 §6.4); en un entorno normal basta `prisma migrate deploy`.

-- CreateEnum
CREATE TYPE "AmvaCity" AS ENUM ('MEDELLIN', 'BELLO', 'ITAGUI', 'ENVIGADO', 'SABANETA', 'LA_ESTRELLA', 'CALDAS', 'COPACABANA', 'GIRARDOTA', 'BARBOSA');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'BASE', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "plan" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" "PlanCode" NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "price_cop" INTEGER NOT NULL,
    "interval_months" SMALLINT NOT NULL,
    "trial_days" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plan_price_cop_check" CHECK ("price_cop" >= 0),
    CONSTRAINT "plan_interval_months_check" CHECK ("interval_months" IN (1, 3, 6, 12)),
    CONSTRAINT "plan_trial_days_check" CHECK ("trial_days" >= 0 AND "trial_days" <= 90)
);

-- CreateTable
CREATE TABLE "business" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "city" "AmvaCity" NOT NULL,
    "address_line" VARCHAR(160),
    "whatsapp_e164" VARCHAR(20) NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'APPROVED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "business_name_check" CHECK (char_length("name") >= 2),
    CONSTRAINT "business_slug_check" CHECK ("slug" ~ '^[a-z0-9-]{3,60}$'),
    CONSTRAINT "business_whatsapp_check" CHECK ("whatsapp_e164" ~ '^\+57[0-9]{10}$')
);

-- CreateTable
CREATE TABLE "business_membership" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'OWNER',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_period_check" CHECK ("current_period_end" > "current_period_start")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_slug_key" ON "business"("slug");

-- CreateIndex
CREATE INDEX "business_status_idx" ON "business"("status");

-- CreateIndex
CREATE UNIQUE INDEX "plan_code_key" ON "plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "plan_name_key" ON "plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "business_membership_business_id_user_id_key" ON "business_membership"("business_id", "user_id");

-- CreateIndex
CREATE INDEX "business_membership_user_id_idx" ON "business_membership"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_business_id_key" ON "subscription"("business_id");

-- CreateIndex
CREATE INDEX "subscription_plan_id_idx" ON "subscription"("plan_id");

-- CreateIndex
CREATE INDEX "subscription_status_idx" ON "subscription"("status");

-- AddForeignKey
ALTER TABLE "business_membership" ADD CONSTRAINT "business_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_membership" ADD CONSTRAINT "business_membership_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
