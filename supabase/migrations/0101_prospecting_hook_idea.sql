-- Prospección: para subir la tasa de respuesta, el descubrimiento ahora captura
-- (con la búsqueda web) dos cosas listas para el mensaje:
--  - gancho: una observación MUY específica y real de su presencia digital, para
--    citar y que se note que miramos SU cuenta (no un copy genérico).
--  - idea: una idea concreta y accionable que le ofrecemos gratis como anzuelo
--    (vale más que pedir "una llamada").
alter table public.prospecting_leads
  add column if not exists gancho text,
  add column if not exists idea   text;
