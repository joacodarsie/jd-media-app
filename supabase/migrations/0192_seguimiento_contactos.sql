-- Seguimiento de los contactos de prospección (6/10/2026).
--
-- En los últimos 30 días se escribió a ~750 negocios y salieron 3 reuniones.
-- 870 contactos quedaron en "contactado" con un solo mensaje: nadie les volvió
-- a escribir, aunque las 13 campañas ya tenían armados los mensajes de
-- seguimiento 1 y 2. Esto guarda cuántos seguimientos se mandaron y cuándo el
-- último, para que la tabla ofrezca el que toca.

alter table public.prospecting_contacts
  add column if not exists seguimientos smallint not null default 0,
  add column if not exists seguimiento_at timestamptz;

comment on column public.prospecting_contacts.seguimientos is
  'Cuántos mensajes de seguimiento se mandaron después del primero (0, 1 o 2).';
comment on column public.prospecting_contacts.seguimiento_at is
  'Cuándo se mandó el último seguimiento.';
