-- Pausa de cuenta por mes: un cliente puede pausar el servicio uno o más meses
-- (ej. Origen pausa agosto 2026 y retoma en septiembre). Cada período pausado
-- ('YYYY-MM') se saca de: generación de cobros, nómina del equipo y panorama de
-- ese mes. La cuenta sigue 'activo' (no se pierde el historial ni el equipo).
alter table public.clients
  add column if not exists pausas text[] not null default '{}';

comment on column public.clients.pausas is
  'Meses pausados en formato YYYY-MM. Ese mes no genera cobro, ni nómina de equipo, ni cuenta en el panorama. La cuenta sigue activa.';

-- Aura "sin testear" de la feature.
insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/clientes', 'Pausar una cuenta un mes',
   'En la ficha del cliente podés pausar un mes puntual (ej. Origen agosto). Ese mes no se cobra, no se paga al equipo por esa cuenta y no cuenta en el panorama. Verificar mirando el panorama de agosto.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
