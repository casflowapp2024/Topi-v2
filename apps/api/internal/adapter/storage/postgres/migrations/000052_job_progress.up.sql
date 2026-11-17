-- plan/31, bloque A: avance de un job de lectura para la app ("Leyendo 12 de 22 correos"). Solo conteos:
-- {"listed": N, "processed": M, "created": K}. Nada del contenido de los correos.
ALTER TABLE email_jobs ADD COLUMN progress JSONB;
