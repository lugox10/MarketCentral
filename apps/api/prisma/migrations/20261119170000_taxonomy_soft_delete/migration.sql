-- Borrado lógico de atributos y opciones (E5-taxonomía gestionable).
--
-- Vertical y Category ya tenían `is_active` desde E5; aquí se completa la
-- taxonomía para que el panel pueda retirar un atributo o una opción sin
-- borrar los valores que las publicaciones antiguas guardan en `listing.attributes`.

ALTER TABLE "attribute_definition"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "attribute_option"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "attribute_definition_category_id_is_active_idx"
  ON "attribute_definition" ("category_id", "is_active");
