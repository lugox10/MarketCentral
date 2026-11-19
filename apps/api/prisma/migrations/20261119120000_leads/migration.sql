-- E7 · Leads: contacto del comprador con el negocio.
-- Sin chat: el negocio solo gestiona el estado del lead.
-- No se guarda la IP en claro: solo `ip_hash` (HMAC-SHA256 con secreto del servidor).

CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'READ', 'REPLIED', 'ARCHIVED', 'SPAM');
CREATE TYPE "LeadSource" AS ENUM ('LISTING', 'BUSINESS_PROFILE');

CREATE TABLE "lead" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "listing_id" UUID,
    "buyer_name" VARCHAR(100) NOT NULL,
    "buyer_email" VARCHAR(320) NOT NULL,
    "buyer_phone" VARCHAR(20) NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL DEFAULT 'LISTING',
    "consent_at" TIMESTAMPTZ(6) NOT NULL,
    "ip_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "lead_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lead_buyer_name_check" CHECK (btrim("buyer_name") = "buyer_name" AND char_length(btrim("buyer_name")) BETWEEN 2 AND 100),
    CONSTRAINT "lead_buyer_email_check" CHECK ("buyer_email" = lower(btrim("buyer_email")) AND char_length("buyer_email") BETWEEN 5 AND 320),
    CONSTRAINT "lead_buyer_phone_check" CHECK ("buyer_phone" ~ '^\+[1-9][0-9]{7,14}$'),
    CONSTRAINT "lead_message_check" CHECK (btrim("message") = "message" AND char_length("message") BETWEEN 10 AND 2000),
    CONSTRAINT "lead_ip_hash_check" CHECK ("ip_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "lead_retention_check" CHECK ("expires_at" > "created_at")
);

CREATE INDEX "lead_business_id_created_at_idx" ON "lead" ("business_id", "created_at");
CREATE INDEX "lead_business_id_status_created_at_idx" ON "lead" ("business_id", "status", "created_at");
CREATE INDEX "lead_listing_id_created_at_idx" ON "lead" ("listing_id", "created_at");
CREATE INDEX "lead_listing_id_buyer_email_created_at_idx" ON "lead" ("listing_id", "buyer_email", "created_at");
CREATE INDEX "lead_expires_at_idx" ON "lead" ("expires_at");

-- El negocio no se puede borrar mientras tenga leads: la retención de datos
-- personales exige una decisión explícita (y auditada) antes de destruirlos.
ALTER TABLE "lead"
    ADD CONSTRAINT "lead_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Si se borra la publicación, el lead sobrevive sin referencia al anuncio.
ALTER TABLE "lead"
    ADD CONSTRAINT "lead_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listing" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
