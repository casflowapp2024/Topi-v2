-- plan/33: catálogo de bancos editable desde el admin. Reemplaza enums.OfficialBanks.

CREATE TABLE bank_catalog (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  country CHAR(2) NOT NULL DEFAULT 'CO',
  color VARCHAR(7) NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  -- inactivo: no aparece para elegir, pero sigue leyendo a quien ya lo tiene
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- un remitente por fila. El mismo correo puede estar en dos bancos (Davibank y ScotiaBank comparten uno).
-- No se borran: se desactivan, para que una copia vieja en banks.email no vuelva como remitente extra.
CREATE TABLE bank_catalog_senders (
  id BIGSERIAL PRIMARY KEY,
  bank_id BIGINT NOT NULL REFERENCES bank_catalog (id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(btrim(email)) AND email ~ '^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$'),
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT NULL CHECK (note IS NULL OR length(note) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bank_id, email)
);

CREATE TABLE bank_logos (
  bank_id BIGINT PRIMARY KEY REFERENCES bank_catalog (id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/png', 'image/webp', 'image/svg+xml')),
  bytes BYTEA NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 102400),
  etag TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE banks ADD COLUMN catalog_id BIGINT NULL REFERENCES bank_catalog (id);
CREATE INDEX banks_catalog_id ON banks (catalog_id);

-- misma regla que domain.normalizeBankName: minúsculas y espacios colapsados
CREATE FUNCTION normalize_bank_name(name TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(regexp_replace(coalesce(name, ''), '\s+', ' ', 'g')))
$$;

-- Remitentes con los que se lee un banco del usuario, separados por coma (el contrato de banks.email):
-- los activos del catálogo + lo que el usuario escribió que no es un remitente del catálogo (activo o no).
-- Sin catálogo: banks.email tal cual, sin repetidos.
CREATE FUNCTION bank_effective_senders(p_catalog_id BIGINT, p_email TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$
  WITH typed AS (
    SELECT DISTINCT ON (lower(btrim(x))) lower(btrim(x)) AS email, ord
    FROM unnest(string_to_array(coalesce(p_email, ''), ',')) WITH ORDINALITY AS t(x, ord)
    WHERE btrim(x) LIKE '%@%'
    ORDER BY lower(btrim(x)), ord
  ),
  official AS (
    SELECT s.email, s.id AS ord FROM bank_catalog_senders s
    WHERE p_catalog_id IS NOT NULL AND s.bank_id = p_catalog_id AND s.active
  ),
  extra AS (
    SELECT t.email, t.ord FROM typed t
    WHERE p_catalog_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM bank_catalog_senders s WHERE s.bank_id = p_catalog_id AND s.email = t.email)
  )
  SELECT coalesce(string_agg(email, ',' ORDER BY grp, ord), '')
  FROM (SELECT email, ord, 0 AS grp FROM official UNION ALL SELECT email, ord, 1 FROM extra) u
$$;

-- datos iniciales: los 11 bancos de enums.OfficialBanks (22-nov-2026)
INSERT INTO bank_catalog (slug, name) VALUES
  ('bancolombia', 'Bancolombia'),
  ('bbva', 'BBVA'),
  ('davibank', 'Davibank'),
  ('scotiabank', 'ScotiaBank'),
  ('airtm', 'AirTm'),
  ('hapi', 'Hapi'),
  ('itau', 'Itaú'),
  ('lulo-bank', 'Lulo Bank'),
  ('nubank', 'Nubank'),
  ('rappipay', 'RappiPay'),
  ('trii', 'Trii');

INSERT INTO bank_catalog_senders (bank_id, email)
SELECT c.id, lower(s.email)
FROM (VALUES
  ('bancolombia', 'alertasynotificaciones@notificacionesbancolombia.com'),
  ('bancolombia', 'alertasynotificaciones@bancolombia.com.co'),
  ('bancolombia', 'alertasynotificaciones@an.notificacionesbancolombia.com'),
  ('bbva', 'BBVA@bbvanet.com.co'),
  ('bbva', 'notificacionesBreB@bbva.com'),
  ('davibank', 'DAVIbankInforma@davibank.com'),
  ('scotiabank', 'colpatriaInforma@scotiabankcolpatria.com'),
  ('scotiabank', 'DAVIbankInforma@davibank.com'),
  ('airtm', 'noreply@airtm.com'),
  ('hapi', 'no-reply@hapi.trade'),
  ('itau', 'Notificaciones@clienteitau.co'),
  ('lulo-bank', 'notificaciones@lulobank.com'),
  ('nubank', 'nu@nu.com.co'),
  ('rappipay', 'rappi.nreply@rappi.com'),
  ('rappipay', 'noreply@rappicard.co'),
  ('rappipay', 'noreply@rappipay.co'),
  ('trii', 'Tri@trii.co')
) AS s (slug, email)
JOIN bank_catalog c ON c.slug = s.slug;

-- backfill: los bancos de usuario con el nombre de uno del catálogo quedan ligados
UPDATE banks b SET catalog_id = c.id
FROM bank_catalog c
WHERE normalize_bank_name(b.name) = normalize_bank_name(c.name);

-- los remitentes efectivos van en minúscula: el avance por remitente también, o el worker tomaría
-- 'BBVA@bbvanet.com.co' como un remitente nuevo y repetiría la primera lectura. Si hay dos filas que solo
-- cambian en mayúsculas, queda la de la lectura más reciente.
DELETE FROM email_sync_state s
USING email_sync_state o
WHERE s.email_id = o.email_id
  AND lower(s.sender_email) = lower(o.sender_email)
  AND s.sender_email <> o.sender_email
  AND (s.last_run, s.sender_email) < (o.last_run, o.sender_email);

UPDATE email_sync_state SET sender_email = lower(sender_email) WHERE sender_email <> lower(sender_email);
