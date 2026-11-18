-- E5: el precio de una publicación deja de estar atado al peso colombiano.
-- Se renombra la columna a un nombre neutral y se admite COP o USD; el importe
-- sigue siendo un entero en la unidad menor de la moneda (pesos y dólares sin
-- centavos en el MVP, igual que antes).

ALTER TABLE "listing" RENAME COLUMN "price_cop" TO "price_amount";

ALTER TABLE "listing" DROP CONSTRAINT IF EXISTS "listing_currency_check";
ALTER TABLE "listing"
  ADD CONSTRAINT "listing_currency_check" CHECK ("currency" IN ('COP', 'USD'));
