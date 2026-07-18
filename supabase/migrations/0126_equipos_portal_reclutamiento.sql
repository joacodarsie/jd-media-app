-- Batch 2026-07-18: (1) EQUIPOS de trabajo, (2) PORTAL con avisos dirigidos,
-- (3) RECLUTAMIENTO con fases de proceso + transcripciones de entrevista.

-- ────────────────────────────────────────────────────────────────────
-- 1) EQUIPOS: cada equipo tiene su CM, diseñador, editor y paid media.
--    Luz (coordinación de redes) está en todos, no se modela por equipo.
--    Cada cliente pertenece a lo sumo a un equipo.
create table if not exists public.teams (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,                -- "Equipo 1", "Equipo 2", …
  orden          int  not null default 0,
  cm_id          uuid references public.users(id) on delete set null,
  disenador_id   uuid references public.users(id) on delete set null,
  audiovisual_id uuid references public.users(id) on delete set null,
  media_buyer_id uuid references public.users(id) on delete set null,
  notas          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_teams_updated on public.teams;
create trigger trg_teams_updated before update on public.teams
  for each row execute function public.set_updated_at();

alter table public.clients
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists idx_clients_team on public.clients(team_id);

alter table public.teams enable row level security;
drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams
  for select to authenticated using (true); -- estructura interna, la ve todo el equipo
-- Escrituras vía service role (server actions con requireRole admin/coordinador).

-- ────────────────────────────────────────────────────────────────────
-- 2) PORTAL: avisos importantes del admin al equipo, con destinatarios.
--    destinatarios = '{}' → para TODOS. Además de la campanita, aparecen
--    en "Mi día" hasta que cada uno los marque como leídos.
create table if not exists public.portal_notices (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  cuerpo        text not null,
  -- '{}' = todos; si no, lista de user ids destinatarios.
  destinatarios uuid[] not null default '{}',
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now()
);

create table if not exists public.portal_notice_reads (
  notice_id uuid not null references public.portal_notices(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  read_at   timestamptz not null default now(),
  primary key (notice_id, user_id)
);

alter table public.portal_notices enable row level security;
alter table public.portal_notice_reads enable row level security;

drop policy if exists portal_notices_read on public.portal_notices;
create policy portal_notices_read on public.portal_notices
  for select to authenticated
  using (
    destinatarios = '{}'::uuid[]
    or (select auth.uid()) = any (destinatarios)
    or public.jd_is_staff()
  );

drop policy if exists portal_notice_reads_own on public.portal_notice_reads;
create policy portal_notice_reads_own on public.portal_notice_reads
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ────────────────────────────────────────────────────────────────────
-- 3) RECLUTAMIENTO: fases del proceso de selección por candidato +
--    transcripción de la entrevista + análisis comparativo por búsqueda.
alter table public.recruitment_candidates
  add column if not exists fase text not null default 'pool'
    check (fase in ('pool', 'entrevista', 'segunda', 'prueba', 'contratado', 'descartado')),
  add column if not exists fase_updated_at timestamptz,
  add column if not exists entrevista_transcript text,
  add column if not exists entrevista_notas text,
  add column if not exists entrevista_analisis text;

alter table public.recruitment_searches
  add column if not exists analisis_comparativo text,
  add column if not exists analisis_at timestamptz;

create index if not exists recruitment_candidates_fase_idx
  on public.recruitment_candidates (search_id, fase);

-- ────────────────────────────────────────────────────────────────────
-- Aura "sin testear" de las features nuevas de este batch.
insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/portal', 'Portal (ex Novedades) + avisos dirigidos',
   'Crear un aviso con destinatarios, verificar que les llegue la notificación y que aparezca en Mi día hasta marcarlo leído. La pestaña Novedades sigue igual.'),
  ('/coordinacion/equipos', 'Equipos de trabajo',
   'Crear los equipos, asignar CM/diseño/edición/paid y repartir los clientes. Después mirar /clientes agrupado por equipo y el filtro de equipo en el calendario.'),
  ('/reclutamiento', 'Pipeline de candidatos + análisis de entrevistas',
   'Fases (pool → entrevista → 2ª instancia → prueba → contratado), cargar transcripción por candidato, análisis IA individual y comparativo, y miniguía de entrevista por puesto.'),
  ('/coordinacion/mes-uno', 'Mes 1 de un cliente (solo dueño)',
   'Qué se cobra y qué se paga el primer mes por pack, en vivo desde las tarifas. Verificar contra el Excel FNA.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
