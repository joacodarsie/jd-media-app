-- Objetivos de la agencia: un objetivo general + objetivos por área, cada uno
-- con "ideas/iniciativas" adentro para llegar a ese objetivo. Le da norte al
-- equipo y engancha con el tablero del Director (salud por cuenta).

create table if not exists public.agency_objectives (
  id          uuid primary key default gen_random_uuid(),
  -- null = objetivo GENERAL de la agencia; si no, el nombre del área (users.area).
  area        text,
  titulo      text not null,
  detalle     text,
  -- Ideas/iniciativas: [{ id: text, texto: text, done: bool }]
  ideas       jsonb not null default '[]'::jsonb,
  estado      text not null default 'activo'
                check (estado in ('activo', 'logrado', 'pausado')),
  orden       int not null default 0,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_agency_objectives_area
  on public.agency_objectives (area, orden);

drop trigger if exists trg_agency_objectives_updated on public.agency_objectives;
create trigger trg_agency_objectives_updated before update on public.agency_objectives
  for each row execute function public.set_updated_at();

-- RLS: staff (admin/coordinación) puede leer/escribir. Las escrituras de la app
-- van por service_role (bypass), pero dejamos lectura para staff por prolijidad.
alter table public.agency_objectives enable row level security;

drop policy if exists agency_objectives_all on public.agency_objectives;
create policy agency_objectives_all on public.agency_objectives
  for all to authenticated
  using (public.jd_is_staff()) with check (public.jd_is_staff());
