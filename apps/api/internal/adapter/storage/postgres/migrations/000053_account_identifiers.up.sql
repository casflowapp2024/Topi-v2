-- plan/32, bloque A: los últimos 4 dígitos dejan de ser obligatorios y una cuenta puede tener varios
-- (tarjeta adicional o renovada). account_identifiers es la fuente para leer correos; accounts.last_four_digits
-- queda como el número que el usuario escribió ('' = ninguno) y un trigger lo copia como identificador 'user'.
CREATE TABLE account_identifiers (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  bank_id BIGINT NOT NULL,
  account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  digits VARCHAR(4) NOT NULL CHECK (digits ~ '^[0-9]{4}$'),
  source TEXT NOT NULL CHECK (source IN ('user', 'learned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_identifiers_digits_unique UNIQUE (user_id, bank_id, digits)
);

CREATE INDEX account_identifiers_account ON account_identifiers (account_id);

INSERT INTO account_identifiers (user_id, bank_id, account_id, digits, source, created_at)
SELECT user_id, bank_id, id, last_four_digits, 'user', created_at
FROM accounts
WHERE last_four_digits ~ '^[0-9]{4}$'
ON CONFLICT DO NOTHING;

-- sin dígitos se guarda '' (no NULL: las vistas y los scans lo leen como texto)
UPDATE accounts SET last_four_digits = '' WHERE last_four_digits !~ '^[0-9]{4}$';
ALTER TABLE accounts DROP CONSTRAINT unique_user_account;
ALTER TABLE accounts ALTER COLUMN last_four_digits SET DEFAULT '';
ALTER TABLE accounts ADD CONSTRAINT accounts_last_four_digits_check CHECK (last_four_digits ~ '^([0-9]{4})?$');

-- accounts → account_identifiers: el número escrito por el usuario es su identificador 'user'. Cambiar el número
-- reemplaza el anterior 'user' (los aprendidos se quedan); cambiar de banco mueve todos. Si el número ya es de otra
-- cuenta del mismo banco, falla con account_identifiers_digits_unique.
CREATE FUNCTION account_identifiers_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.bank_id <> OLD.bank_id OR NEW.user_id <> OLD.user_id THEN
      UPDATE account_identifiers SET bank_id = NEW.bank_id, user_id = NEW.user_id WHERE account_id = NEW.id;
    END IF;
    IF NEW.last_four_digits IS DISTINCT FROM OLD.last_four_digits AND OLD.last_four_digits <> '' THEN
      DELETE FROM account_identifiers
      WHERE account_id = NEW.id AND digits = OLD.last_four_digits AND source = 'user';
    END IF;
  END IF;

  IF NEW.last_four_digits <> '' THEN
    INSERT INTO account_identifiers (user_id, bank_id, account_id, digits, source)
    VALUES (NEW.user_id, NEW.bank_id, NEW.id, NEW.last_four_digits, 'user')
    ON CONFLICT (user_id, bank_id, digits) DO UPDATE SET source = 'user'
      WHERE account_identifiers.account_id = EXCLUDED.account_id;
    IF NOT EXISTS (SELECT 1 FROM account_identifiers
                   WHERE user_id = NEW.user_id AND bank_id = NEW.bank_id AND digits = NEW.last_four_digits
                     AND account_id = NEW.id) THEN
      RAISE unique_violation USING CONSTRAINT = 'account_identifiers_digits_unique',
        MESSAGE = 'digits already belong to another account';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER account_identifiers_sync
AFTER INSERT OR UPDATE OF last_four_digits, bank_id, user_id ON accounts
FOR EACH ROW EXECUTE FUNCTION account_identifiers_sync();

-- plan/32, bloque C: los dígitos que el LLM vio en el correo, para aprender cuando el usuario corrige la cuenta.
-- Solo 4 dígitos, nada del cuerpo del correo.
ALTER TABLE transactions ADD COLUMN source_account_hint VARCHAR(4)
  CHECK (source_account_hint IS NULL OR source_account_hint ~ '^[0-9]{4}$');

ALTER TABLE product_events DROP CONSTRAINT product_events_name_check;
ALTER TABLE product_events ADD CONSTRAINT product_events_name_check CHECK (name IN (
  'tx_category_corrected', 'tx_amount_corrected', 'review_resolved', 'budget_created',
  'insight_dismissed', 'insight_feedback', 'ask_topi_asked',
  'support_started', 'support_approved',
  'connection_reconnected',
  'onboarding_step_completed', 'bank_sample_requested',
  'feedback_sent',
  'account_identifier_learned'
));
