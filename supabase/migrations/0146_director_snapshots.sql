-- Historia del semáforo del Director: cómo cerró cada mes.
--
-- El semáforo se calcula EN VIVO y varias de sus señales solo existen en
-- presente (tareas vencidas hoy, última vez que el cliente entró al portal,
-- Instagram de los últimos 35 días). Cuando pasa el mes, ese estado se pierde y
-- no hay forma de reconstruirlo: por eso hay que guardarlo.
--
-- Se guarda el resultado completo como jsonb, una fila por período. El cron
-- diario lo pisa todos los días, así que la última escritura de un mes queda
-- congelada como el cierre de ese mes.

create table if not exists public.director_snapshots (
  periodo     text primary key,          -- YYYY-MM
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.director_snapshots enable row level security;

drop policy if exists director_snapshots_read on public.director_snapshots;
create policy director_snapshots_read on public.director_snapshots
  for select to authenticated
  using (public.jd_is_staff());

insert into public.review_flags (ruta, label, nota)
values (
  '/director',
  'Historial de meses del Director IA',
  'Ahora se puede elegir el mes arriba a la derecha. El mes en curso se calcula en vivo; los anteriores salen del registro guardado (se empieza a guardar desde hoy, así que los meses previos van a decir que no hay registro).'
);
