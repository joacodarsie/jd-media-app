-- Director Creativo IA — reportes semanales por cliente.
-- El cron (viernes) genera una fila por cliente activo con:
--   - cuota del pack (quota_*)
--   - PLANEADO en el calendario (proy_*)  = pubs con fecha en el mes, estado != rechazado
--   - PUBLICADO efectivamente (pub_*)      = pubs en estado 'publicado'
--   - pipeline próximas 2 semanas
--   - resumen + ideas generados por IA
-- La UI (/director) los muestra y permite aplicar ideas al calendario.

create table if not exists public.director_reports (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clients(id) on delete cascade,
  semana date not null,                        -- fecha del viernes de la corrida
  pack text,
  status text not null default 'al_dia',       -- 'al_dia' | 'brechas'
  quota_reels int not null default 0,
  quota_posts int not null default 0,
  proy_reels int not null default 0,           -- planeados (calendario)
  proy_posts int not null default 0,
  pub_reels int not null default 0,            -- publicados (subidos)
  pub_posts int not null default 0,
  pipeline_next int not null default 0,
  resumen text,
  ideas jsonb not null default '[]'::jsonb,     -- [{titulo,red,tipo,pilar,copy,applied_pub_id}]
  created_at timestamptz not null default now(),
  unique (cliente_id, semana)
);

create index if not exists director_reports_semana_idx
  on public.director_reports (semana desc);

alter table public.director_reports enable row level security;

-- Lectura: staff ve todo; el CM / creativa ve los reportes de SUS clientes.
drop policy if exists dr_select on public.director_reports;
create policy dr_select on public.director_reports
  for select to authenticated
  using (
    public.jd_is_staff()
    or exists (
      select 1 from public.clients c
      where c.id = director_reports.cliente_id
        and (
          c.cm_id = (select auth.uid())
          or c.creativa_asignada_id = (select auth.uid())
        )
    )
  );

-- Update: staff o responsable del cliente (para marcar ideas aplicadas).
-- El insert/upsert lo hace el cron con service role (bypassa RLS).
drop policy if exists dr_update on public.director_reports;
create policy dr_update on public.director_reports
  for update to authenticated
  using (
    public.jd_is_staff()
    or exists (
      select 1 from public.clients c
      where c.id = director_reports.cliente_id
        and (
          c.cm_id = (select auth.uid())
          or c.creativa_asignada_id = (select auth.uid())
        )
    )
  );
