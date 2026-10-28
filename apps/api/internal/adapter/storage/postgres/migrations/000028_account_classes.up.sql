-- Clase de cada tipo de cuenta (plan/10-tipos-de-cuenta.md, etapa 2): qué producto es y cómo se
-- calcula su saldo.
--   deposit     ahorros, corriente, billetera: saldo inicial + movimientos
--   investment  saldo anclado a la última valoración (account_valuations, 000029)
--   credit      pasivo: saldo negativo = deuda
-- El catálogo es global; los tipos 1–4 son los de enums.SavingTypes/InvestmentTypes/CreditTypes.
ALTER TABLE account_types
  ADD COLUMN class VARCHAR(20) NOT NULL DEFAULT 'deposit'
  CONSTRAINT account_types_class_check CHECK (class IN ('deposit', 'investment', 'credit'));

UPDATE account_types SET class = 'investment' WHERE id = 3;
UPDATE account_types SET class = 'credit' WHERE id = 4;
