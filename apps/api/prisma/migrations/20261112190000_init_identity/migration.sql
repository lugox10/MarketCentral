-- E1 · Identidad, autenticación y sesiones
-- Generado a mano conforme a docs/15, docs/16 y docs/19 (el CLI de Prisma no puede
-- ejecutar su motor en este entorno). Verificar con `pnpm --filter @marketcentral/api exec prisma migrate dev`.

CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'BUSINESS_OWNER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "app_user" (
    "id" uuid NOT NULL DEFAULT uuidv7(),
    "email" varchar(320) NOT NULL,
    "password_hash" varchar(255) NOT NULL,
    "name" varchar(120) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BUSINESS_OWNER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" timestamptz(6),
    "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz(6) NOT NULL,
    "deleted_at" timestamptz(6),
    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "app_user_email_lowercase" CHECK ("email" = lower("email")),
    CONSTRAINT "app_user_email_shape" CHECK ("email" LIKE '%_@_%._%')
);

CREATE UNIQUE INDEX "app_user_email_key" ON "app_user" ("email");

CREATE TABLE "session" (
    "id" uuid NOT NULL DEFAULT uuidv7(),
    "token_hash" varchar(64) NOT NULL,
    "user_id" uuid NOT NULL,
    "expires_at" timestamptz(6) NOT NULL,
    "revoked_at" timestamptz(6),
    "ip_hash" varchar(64),
    "user_agent" varchar(400),
    "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_token_hash_key" ON "session" ("token_hash");
CREATE INDEX "session_user_id_idx" ON "session" ("user_id");
CREATE INDEX "session_expires_at_idx" ON "session" ("expires_at");

CREATE TABLE "password_reset_token" (
    "id" uuid NOT NULL DEFAULT uuidv7(),
    "token_hash" varchar(64) NOT NULL,
    "user_id" uuid NOT NULL,
    "expires_at" timestamptz(6) NOT NULL,
    "used_at" timestamptz(6),
    "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_token_token_hash_key" ON "password_reset_token" ("token_hash");
CREATE INDEX "password_reset_token_user_id_idx" ON "password_reset_token" ("user_id");

CREATE TABLE "email_verification_token" (
    "id" uuid NOT NULL DEFAULT uuidv7(),
    "token_hash" varchar(64) NOT NULL,
    "user_id" uuid NOT NULL,
    "expires_at" timestamptz(6) NOT NULL,
    "used_at" timestamptz(6),
    "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verification_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verification_token_token_hash_key" ON "email_verification_token" ("token_hash");
CREATE INDEX "email_verification_token_user_id_idx" ON "email_verification_token" ("user_id");

ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_verification_token" ADD CONSTRAINT "email_verification_token_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
