-- plan/30, bloque 4: qué encontró la primera lectura de cada remitente. Con esto la app sabe enseguida si el
-- remitente no tiene correos (pedir el correcto) o si hay correos que aún no sabemos leer. Solo conteos.
ALTER TABLE email_sync_state
  ADD COLUMN first_found INTEGER,
  ADD COLUMN first_read_at TIMESTAMPTZ;
