-- E4 · el historial sigue siendo inmutable, pero el borrado de un administrador
-- debe poder anonimizar sus activaciones (FK `ON DELETE SET NULL`). Sin esta
-- excepción, eliminar un `app_user` con activaciones fallaba con "el historial es
-- inmutable", incluido el borrado legítimo de una cuenta por derecho al olvido.
--
-- Única transición permitida: `activated_by_admin_id` pasa de un valor a NULL y
-- ninguna otra columna cambia. Cualquier otra modificación sigue bloqueada.

CREATE OR REPLACE FUNCTION "subscription_activation_block_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" = OLD."id"
     AND NEW."subscription_id" = OLD."subscription_id"
     AND NEW."plan_id" = OLD."plan_id"
     AND NEW."kind" = OLD."kind"
     AND NEW."note" = OLD."note"
     AND NEW."activated_at" = OLD."activated_at"
     AND NEW."period_start" = OLD."period_start"
     AND NEW."previous_period_end" IS NOT DISTINCT FROM OLD."previous_period_end"
     AND NEW."new_period_end" = OLD."new_period_end"
     AND NEW."price_cop" = OLD."price_cop"
     AND NEW."currency" = OLD."currency"
     AND NEW."idempotency_key" IS NOT DISTINCT FROM OLD."idempotency_key"
     AND NEW."request_hash" IS NOT DISTINCT FROM OLD."request_hash"
     AND NEW."activated_by_admin_id" IS NULL
     AND OLD."activated_by_admin_id" IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'subscription_activation es inmutable: UPDATE bloqueado';
END;
$$;
