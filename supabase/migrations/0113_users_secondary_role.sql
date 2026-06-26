-- Roles duales: una persona puede cumplir 2 roles en la agencia (ej. una CM que
-- también hace Comercial). Guardamos un rol y un área SECUNDARIOS opcionales.
--  - rol_secundario: suma los permisos por defecto de ese rol y cuenta para
--    sueldos (fijo de comercial, fallbacks de media buyer/coordinación) y para
--    páginas gateadas por rol.
--  - area_secundaria: hace que la persona figure también en esa área
--    (organigrama y "tareas por área").
alter table public.users
  add column if not exists rol_secundario  user_role,
  add column if not exists area_secundaria text;
