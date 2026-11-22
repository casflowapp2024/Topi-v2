-- plan/32: las inversiones no se reconocen por dígitos. Los números que se pusieron cuando eran obligatorios dejan
-- de mostrarse: se quita el número escrito (el trigger borra su identificador 'user') y cualquier otro identificador.
UPDATE accounts a SET last_four_digits = '', updated_at = now()
FROM account_types at
WHERE at.id = a.type_id AND at.class = 'investment' AND a.last_four_digits <> '';

DELETE FROM account_identifiers ai
USING accounts a, account_types at
WHERE ai.account_id = a.id AND at.id = a.type_id AND at.class = 'investment';
