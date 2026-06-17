-- Historias de Instagram capturadas a diario. La API de IG solo expone las
-- historias ACTIVAS (últimas 24h), así que el sync diario las va guardando y
-- acumulando (no se pueden recuperar las viejas). Dedupe por (cliente, story_id).

create table if not exists public.ig_stories (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clients(id) on delete cascade,
  story_id      text not null,                  -- media id de la historia en IG
  media_type    text,                           -- IMAGE | VIDEO
  permalink     text,
  thumbnail_url text,
  media_url     text,
  posted_at     timestamptz,                    -- cuándo se publicó
  reach         bigint,
  replies       bigint,
  captured_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (cliente_id, story_id)
);
create index if not exists idx_igstories_cliente_fecha
  on public.ig_stories(cliente_id, posted_at desc);

drop trigger if exists trg_igstories_updated on public.ig_stories;
create trigger trg_igstories_updated before update on public.ig_stories
  for each row execute function public.set_updated_at();

-- Acceso: vía service_role en el server. Sin policies públicas → RLS lo bloquea.
alter table public.ig_stories enable row level security;
