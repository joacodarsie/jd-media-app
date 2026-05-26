-- Permite al admin ver las contraseñas de los usuarios que el mismo seteo.
-- Se guarda en plaintext en una columna que SOLO se lee desde /accesos
-- (admin-only). El resto de queries de la app no traen este campo.
--
-- Riesgo aceptado: si alguien con permiso de SELECT a la tabla users
-- consultara explicitamente este campo desde fuera del flujo /accesos, lo
-- veria. La RLS de Postgres no se puede aplicar por columna sin truco; el
-- aislamiento queda en codigo.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_visible TEXT;

COMMENT ON COLUMN users.password_visible IS
  'Contrasena en plaintext seteada por admin. Solo visible desde /accesos. Se actualiza al setear/cambiar pass.';
