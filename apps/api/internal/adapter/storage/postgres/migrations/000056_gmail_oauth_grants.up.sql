-- Cupos de Google (plan/28 §7): Google cuenta cada cuenta que dio permiso alguna vez, también las borradas. Aquí
-- queda un hash SHA-256 de la dirección (nunca la dirección) de cada cuenta de Gmail que se conectó, y no se borra al
-- quitar la conexión, igual que el contador de Google.
CREATE TABLE gmail_oauth_grants (
  email_hash       TEXT PRIMARY KEY,
  first_granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE FUNCTION gmail_oauth_grant_hash(p_email TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE AS $$ SELECT encode(sha256(convert_to(lower(trim(p_email)), 'UTF8')), 'hex') $$;

INSERT INTO gmail_oauth_grants (email_hash, first_granted_at)
SELECT gmail_oauth_grant_hash(email), min(created_at) FROM emails WHERE provider = 'gmail' GROUP BY 1
ON CONFLICT DO NOTHING;

CREATE FUNCTION gmail_oauth_grant_record() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.provider = 'gmail' THEN
    INSERT INTO gmail_oauth_grants (email_hash) VALUES (gmail_oauth_grant_hash(NEW.email)) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER emails_gmail_oauth_grant AFTER INSERT OR UPDATE OF email, provider ON emails
  FOR EACH ROW EXECUTE FUNCTION gmail_oauth_grant_record();
