-- Resultados de Instagram por cliente (lo que el cliente ve como "resultado final"
-- de la gestión de redes + pauta). Reusa el system user token de Meta que ya usa
-- paid media: la cuenta de IG del cliente tiene que ser Business/Creator, vinculada
-- a una página de Facebook asignada al system user, y el token debe tener los
-- permisos instagram_basic, instagram_manage_insights, pages_read_engagement,
-- pages_show_list.

-- 1) Cuenta de Instagram (IG Business Account) del cliente.
alter table public.clients
  add column if not exists ig_user_id  text,   -- ID numérico del IG Business Account
  add column if not exists ig_username text;    -- @usuario (cache para mostrar)

comment on column public.clients.ig_user_id is
  'ID del Instagram Business Account (vía Graph API) para traer los resultados orgánicos del cliente.';

-- 2) Snapshot diario de resultados de Instagram por cliente.
create table if not exists public.ig_snapshots (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clients(id) on delete cascade,
  fecha           date not null,                  -- día de las métricas
  followers       bigint not null default 0,      -- seguidores TOTALES ese día
  follows         bigint not null default 0,      -- a cuántos sigue la cuenta
  media_count     bigint not null default 0,      -- publicaciones totales
  reach           bigint not null default 0,      -- alcance del día
  profile_views   bigint not null default 0,      -- visitas al perfil del día
  interactions    bigint not null default 0,      -- interacciones del día (likes+coment+guardados+compartidos)
  detalle         jsonb,                           -- { month: {reach,profile_views,interactions}, top_media: [...] }
  created_at      timestamptz not null default now(),
  unique (cliente_id, fecha)
);
create index if not exists idx_igs_cliente_fecha on public.ig_snapshots(cliente_id, fecha desc);

-- Acceso: vía service_role en el server (tras requireRole/asignación). Sin policies
-- públicas → RLS bloquea el acceso directo de clientes.
alter table public.ig_snapshots enable row level security;
