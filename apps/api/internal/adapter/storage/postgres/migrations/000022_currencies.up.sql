-- Multimoneda (Fase 1): catálogo de monedas ISO 4217.
-- minor_units solo se usa para redondear al mostrar; los montos se guardan sin redondear.
-- COP va con 0 decimales (como se muestra hoy en la app), aunque ISO 4217 le asigna 2.
CREATE TABLE currencies (
  code        VARCHAR(3) PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  name        VARCHAR(64) NOT NULL,
  symbol      VARCHAR(8) NOT NULL,
  minor_units SMALLINT NOT NULL CHECK (minor_units BETWEEN 0 AND 4),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO currencies (code, name, symbol, minor_units) VALUES
  ('COP', 'Peso colombiano',      '$',   0),
  ('USD', 'Dólar estadounidense', 'US$', 2),
  ('EUR', 'Euro',                 '€',   2),
  ('MXN', 'Peso mexicano',        'MX$', 2),
  ('GBP', 'Libra esterlina',      '£',   2),
  ('BRL', 'Real brasileño',       'R$',  2),
  ('CAD', 'Dólar canadiense',     'CA$', 2);
