-- E3 · Taxonomía global: verticales, categorías jerárquicas, atributos y opciones.
-- Solo añade estructuras nuevas; no toca tablas de E1/E2.

-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'ENUM');

-- CreateTable
CREATE TABLE "vertical" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "vertical_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vertical_name_not_blank" CHECK (length(btrim("name")) BETWEEN 2 AND 60),
    CONSTRAINT "vertical_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "vertical_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "category_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "category_name_not_blank" CHECK (length(btrim("name")) BETWEEN 2 AND 60),
    CONSTRAINT "category_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT "category_parent_not_self" CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);

-- CreateTable
CREATE TABLE "attribute_definition" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "category_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "type" "AttributeType" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_filterable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "attribute_definition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attribute_definition_name_not_blank" CHECK (length(btrim("name")) BETWEEN 2 AND 60),
    CONSTRAINT "attribute_definition_code_format" CHECK ("code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- CreateTable
CREATE TABLE "attribute_option" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "attribute_definition_id" UUID NOT NULL,
    "value" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "attribute_option_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attribute_option_value_not_blank" CHECK (length(btrim("value")) BETWEEN 1 AND 60)
);

-- CreateIndex
CREATE UNIQUE INDEX "vertical_name_key" ON "vertical"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vertical_slug_key" ON "vertical"("slug");

-- CreateIndex
CREATE INDEX "vertical_is_active_idx" ON "vertical"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "category_vertical_id_slug_key" ON "category"("vertical_id", "slug");

-- CreateIndex
CREATE INDEX "category_vertical_id_idx" ON "category"("vertical_id");

-- CreateIndex
CREATE INDEX "category_parent_id_idx" ON "category"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definition_category_id_code_key" ON "attribute_definition"("category_id", "code");

-- CreateIndex
CREATE INDEX "attribute_definition_category_id_idx" ON "attribute_definition"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_option_attribute_definition_id_value_key" ON "attribute_option"("attribute_definition_id", "value");

-- CreateIndex
CREATE INDEX "attribute_option_attribute_definition_id_idx" ON "attribute_option"("attribute_definition_id");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "vertical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_definition" ADD CONSTRAINT "attribute_definition_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_option" ADD CONSTRAINT "attribute_option_attribute_definition_id_fkey" FOREIGN KEY ("attribute_definition_id") REFERENCES "attribute_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
