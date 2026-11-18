-- E5 · Fases 3 y 4: publicaciones del negocio y sus imágenes.
--
-- Reglas que el esquema protege por sí mismo:
--   * precio no negativo y moneda COP;
--   * título y descripción con longitud mínima (el máximo lo fija el tipo);
--   * slug con formato seguro en la URL;
--   * `position` de imagen entre 0 y 5 (máximo 6 imágenes por publicación);
--   * una imagen no se repite en la misma posición.
-- Las transiciones de estado y los cupos del plan se validan en dominio.

CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SOLD', 'ARCHIVED');
CREATE TYPE "ListingCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'FOR_PARTS');

CREATE TABLE "listing" (
  "id"                        UUID NOT NULL DEFAULT uuidv7(),
  "business_id"               UUID NOT NULL,
  "category_id"               UUID NOT NULL,
  "title"                     VARCHAR(120) NOT NULL,
  "description"               VARCHAR(4000) NOT NULL,
  "condition"                 "ListingCondition" NOT NULL,
  "price_cop"                 INTEGER NOT NULL,
  "currency"                  CHAR(3) NOT NULL DEFAULT 'COP',
  "status"                    "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "slug"                      VARCHAR(90) NOT NULL,
  "attributes"                JSONB NOT NULL DEFAULT '{}'::jsonb,
  "attributes_schema_version" SMALLINT NOT NULL DEFAULT 1,
  "featured"                  BOOLEAN NOT NULL DEFAULT false,
  "featured_at"               TIMESTAMPTZ(6),
  "published_at"              TIMESTAMPTZ(6),
  "sold_at"                   TIMESTAMPTZ(6),
  "archived_at"               TIMESTAMPTZ(6),
  "created_at"                TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"                TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "listing_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "listing_price_cop_check" CHECK ("price_cop" >= 0),
  CONSTRAINT "listing_currency_check" CHECK ("currency" = 'COP'),
  CONSTRAINT "listing_title_check" CHECK (char_length(btrim("title")) BETWEEN 5 AND 120),
  CONSTRAINT "listing_description_check" CHECK (char_length("description") BETWEEN 20 AND 4000),
  CONSTRAINT "listing_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT "listing_attributes_check" CHECK (jsonb_typeof("attributes") = 'object'),
  CONSTRAINT "listing_attributes_version_check" CHECK ("attributes_schema_version" >= 1),
  CONSTRAINT "listing_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE,
  CONSTRAINT "listing_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "listing_business_id_slug_key" ON "listing" ("business_id", "slug");
CREATE INDEX "listing_business_id_status_idx" ON "listing" ("business_id", "status");
CREATE INDEX "listing_category_id_status_idx" ON "listing" ("category_id", "status");
CREATE INDEX "listing_status_featured_idx" ON "listing" ("status", "featured");

CREATE TABLE "listing_image" (
  "id"          UUID NOT NULL DEFAULT uuidv7(),
  "listing_id"  UUID NOT NULL,
  "storage_key" VARCHAR(300) NOT NULL,
  "mime_type"   VARCHAR(40) NOT NULL,
  "size_bytes"  INTEGER NOT NULL,
  "width"       INTEGER,
  "height"      INTEGER,
  "position"    SMALLINT NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "listing_image_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "listing_image_position_check" CHECK ("position" BETWEEN 0 AND 5),
  CONSTRAINT "listing_image_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 5242880),
  CONSTRAINT "listing_image_mime_check" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT "listing_image_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listing"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "listing_image_listing_id_position_key" ON "listing_image" ("listing_id", "position");
CREATE INDEX "listing_image_listing_id_idx" ON "listing_image" ("listing_id");
