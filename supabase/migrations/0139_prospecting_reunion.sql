-- Máquina de clientes: medir el paso que más importa del embudo.
--
-- El modelo que cerramos con Leo tiene dos perillas: el % de contactados que
-- AGENDA una reunión y el % de reuniones que CIERRA. La primera no se podía
-- medir: la tabla de contactos solo distinguía contactado / interesado, y
-- "interesado" mezcla al que respondió con ganas con el que ya tiene fecha.
--
-- Con `reunion_at` (se sella al pasar el contacto a estado "reunion") el embudo
-- queda completo y con fecha, así el tablero puede mostrar el flujo por semana
-- en vez de una foto del estado actual.
alter table public.prospecting_contacts
  add column if not exists reunion_at timestamptz;

create index if not exists prospecting_contacts_reunion_idx
  on public.prospecting_contacts (reunion_at desc)
  where reunion_at is not null;

-- Aura "sin testear" del tablero nuevo.
insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/objetivos/maquina', 'Tablero: Máquina de clientes',
   'Métricas → "Máquina de clientes". Chequeá que el conteo de clientes activos, el ritmo necesario para llegar a 50 y el embudo (contactos → contactados → reuniones → cierres) coincidan con lo que ves en Prospección y en Clientes. Estado nuevo en Contactos: "Reunión agendada" — marcá uno y fijate que aparezca en el tablero de la semana.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
