-- Vuelve a la 000029. Los cambios de moneda ya aplicados se quedan (solo se pierde poder deshacerlos).
DROP FUNCTION change_base_currency(VARCHAR, VARCHAR, BOOLEAN);
DROP FUNCTION undo_account_currency_change(VARCHAR, BIGINT);
DROP FUNCTION change_account_currency(VARCHAR, BIGINT, VARCHAR, VARCHAR, BOOLEAN);
DROP TABLE account_currency_changes;
DROP FUNCTION account_balance_now(VARCHAR, BIGINT);
ALTER TABLE accounts DROP COLUMN closed_at;
