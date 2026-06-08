-- Acuerdos particulares de costo por cuenta (override).
-- Algunas cuentas viejas no siguen el modelo por-pieza: una sola persona hace
-- toda la gestión por un monto fijo. Guardamos ese costo fijo + a quién se le
-- paga, para que el panorama y (a futuro) la nómina reflejen el costo real.

alter table public.client_services
  add column if not exists costo_override numeric,
  add column if not exists costo_override_user uuid references public.users(id) on delete set null;

comment on column public.client_services.costo_override is
  'Costo de equipo fijo de esta cuenta (reemplaza el cálculo por-pieza). Acuerdos particulares.';
comment on column public.client_services.costo_override_user is
  'Persona a la que se le paga el costo_override completo.';

-- Acuerdo de Luz (id 00000000-...-006): hace CM + diseño + edición de estas
-- cuentas viejas por un fijo. La pauta, si la hubiera, va aparte.
update public.client_services s
set costo_override = 140000, costo_override_user = '00000000-0000-0000-0000-000000000006'
from public.clients c
where s.cliente_id = c.id and s.tipo = 'gestion_redes' and c.nombre = 'Desafío Ansenuza';

update public.client_services s
set costo_override = 140000, costo_override_user = '00000000-0000-0000-0000-000000000006'
from public.clients c
where s.cliente_id = c.id and s.tipo = 'gestion_redes' and c.nombre = 'Drop Producciones';

update public.client_services s
set costo_override = 150000, costo_override_user = '00000000-0000-0000-0000-000000000006'
from public.clients c
where s.cliente_id = c.id and s.tipo = 'gestion_redes' and c.nombre = 'Dr Humberto Dionisi';
