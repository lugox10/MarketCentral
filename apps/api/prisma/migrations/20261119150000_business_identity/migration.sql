-- E5 · F1 tiendas digitales: identidad pública del negocio.
-- Tres columnas nullable: una tienda sin descripción/logo/portada sigue siendo
-- válida y se pinta con el tema de su vertical.

ALTER TABLE "business"
  ADD COLUMN "description" VARCHAR(600),
  ADD COLUMN "logo_key" VARCHAR(300),
  ADD COLUMN "cover_key" VARCHAR(300);

-- La descripción, si existe, se guarda ya recortada y con un mínimo útil.
ALTER TABLE "business"
  ADD CONSTRAINT "business_description_check"
  CHECK (
    "description" IS NULL
    OR char_length(btrim("description")) BETWEEN 20 AND 600
  );

-- Las claves son rutas dentro del almacenamiento de objetos, no URLs.
ALTER TABLE "business"
  ADD CONSTRAINT "business_logo_key_check"
  CHECK (
    "logo_key" IS NULL
    OR (
      char_length("logo_key") BETWEEN 5 AND 300
      AND "logo_key" LIKE 'businesses/%'
    )
  );

ALTER TABLE "business"
  ADD CONSTRAINT "business_cover_key_check"
  CHECK (
    "cover_key" IS NULL
    OR (
      char_length("cover_key") BETWEEN 5 AND 300
      AND "cover_key" LIKE 'businesses/%'
    )
  );
