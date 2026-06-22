-- Reclutamiento: análisis de CVs con IA. Una "búsqueda" agrupa los candidatos
-- de un puesto; cada candidato es un CV analizado (de carga manual o de Gmail).
-- Datos personales sensibles → RLS staff (admin/coordinación).

create table if not exists public.recruitment_searches (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,                 -- ej: "Editor/a audiovisual"
  area           text,                          -- cm | diseno | edicion | pauta | desarrollo | otro
  perfil         text,                          -- qué se busca (para que la IA puntúe el fit)
  ubicacion_pref text default 'Córdoba Capital',
  estado         text not null default 'abierta', -- abierta | cerrada
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.recruitment_candidates (
  id                  uuid primary key default gen_random_uuid(),
  search_id           uuid not null references public.recruitment_searches(id) on delete cascade,
  nombre              text,
  email               text,
  telefono            text,
  ubicacion           text,
  es_cordoba_capital  boolean,
  area                text,
  anios_experiencia   numeric,
  skills              text[] default '{}',
  educacion           text,
  resumen             text,
  fortalezas          text[] default '{}',
  dudas               text[] default '{}',
  fit_score           int,                      -- 0..100 según el perfil buscado
  fuente              text not null default 'upload', -- upload | gmail
  source_ref          text,                     -- nombre de archivo o id del mail (dedup)
  archivo_nombre      text,
  created_at          timestamptz not null default now()
);

-- Evita cargar dos veces el mismo CV en una búsqueda (por archivo / id de mail).
create unique index if not exists recruitment_candidates_search_source_uniq
  on public.recruitment_candidates (search_id, source_ref)
  where source_ref is not null;

create index if not exists recruitment_candidates_search_idx
  on public.recruitment_candidates (search_id);

drop trigger if exists trg_recruitment_searches_updated on public.recruitment_searches;
create trigger trg_recruitment_searches_updated before update on public.recruitment_searches
  for each row execute function public.set_updated_at();

alter table public.recruitment_searches enable row level security;
alter table public.recruitment_candidates enable row level security;

drop policy if exists recruitment_searches_all on public.recruitment_searches;
create policy recruitment_searches_all on public.recruitment_searches
  for all to authenticated
  using (public.jd_is_staff()) with check (public.jd_is_staff());

drop policy if exists recruitment_candidates_all on public.recruitment_candidates;
create policy recruitment_candidates_all on public.recruitment_candidates
  for all to authenticated
  using (public.jd_is_staff()) with check (public.jd_is_staff());
