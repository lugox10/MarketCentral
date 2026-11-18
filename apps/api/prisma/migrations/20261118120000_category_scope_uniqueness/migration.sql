-- E5 · Fase 2: la unicidad de `category.slug` deja de ser (vertical, slug) para
-- todos los ámbitos y pasa a dos índices parciales:
--   * global:  (vertical_id, slug) WHERE business_id IS NULL
--   * propia:  (vertical_id, business_id, slug) WHERE business_id IS NOT NULL
--
-- La migración de Fase 1 intentó retirar el índice heredado con
-- `ALTER TABLE ... DROP CONSTRAINT`, pero Prisma lo creó como **índice único**
-- (`category_vertical_id_slug_key`), así que la sentencia no hizo nada. Se
-- elimina aquí de forma explícita.

DROP INDEX IF EXISTS "category_vertical_id_slug_key";

-- Los índices parciales se crean con IF NOT EXISTS por si la base ya los tiene.
CREATE UNIQUE INDEX IF NOT EXISTS "category_global_vertical_slug_key"
  ON "category" ("vertical_id", "slug")
  WHERE "business_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "category_business_vertical_slug_key"
  ON "category" ("vertical_id", "business_id", "slug")
  WHERE "business_id" IS NOT NULL;
