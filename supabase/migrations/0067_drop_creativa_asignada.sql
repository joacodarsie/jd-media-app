-- Eliminación del puesto "Creativa" (modelo viejo).
-- El dato ya se migró a cm_id (la CM es la responsable de la cuenta) y no queda
-- ninguna referencia en código a creativa_asignada_id. Soltamos la columna.
--
-- APLICAR DESPUÉS de que el deploy con el código nuevo esté en producción
-- (el código viejo todavía leía esta columna).
--
-- Nota: los valores de enum 'creativa' (user_role) y 'Creativas' (área) quedan
-- en el tipo de Postgres porque no se pueden eliminar de forma segura, pero ya
-- no se usan en ningún lado.

alter table public.clients
  drop column if exists creativa_asignada_id;
