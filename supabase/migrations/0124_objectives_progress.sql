-- Progreso numérico opcional para los objetivos: una meta, un valor actual y la
-- unidad (ej: 50 clientes fijos, vamos 15). Cuando `meta` está seteada, la
-- sección muestra una barra de progreso. Si quedan en null, el objetivo sigue
-- funcionando como antes (solo con ideas/checklist).
alter table public.agency_objectives
  add column if not exists meta      numeric,
  add column if not exists progreso  numeric,
  add column if not exists unidad    text;

-- Ejemplo ya sembrado: "Llegar a 50 clientes fijos". Hoy vamos 15.
update public.agency_objectives
   set meta = 50, progreso = 15, unidad = 'clientes fijos'
 where titulo ilike 'Llegar a 50 clientes fijos%'
   and meta is null;
