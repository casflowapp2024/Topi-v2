-- Lo usan infra/scripts/make-admin.sh y su versión de producción en infra/scripts/prod/. Variables psql: :'email'
UPDATE users SET role = 'admin', updated_at = now()
WHERE lower(email) = lower(trim(:'email'))
RETURNING id || ' ' || email || ' role=' || role;
