-- Conexiones de Google Calendar (OAuth tokens) por usuario.
-- visibility = 'private': solo owner_user_id puede ver eventos.
-- visibility = 'shared':  todos los usuarios autenticados del equipo pueden ver eventos.
-- Los tokens NUNCA se exponen al client: las API routes usan service role.

create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  label text not null,
  visibility text not null check (visibility in ('private', 'shared')),
  google_email text not null,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  scope text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, google_email)
);

create index if not exists google_calendar_connections_owner_idx
  on public.google_calendar_connections(owner_user_id);

create index if not exists google_calendar_connections_visibility_idx
  on public.google_calendar_connections(visibility);

alter table public.google_calendar_connections enable row level security;

-- Bloqueo total al client (anon + authenticated). Todo va por service role en API routes.
-- No definimos policies de SELECT/INSERT/UPDATE/DELETE para anon ni authenticated.

-- Trigger updated_at
create or replace function public.touch_google_calendar_connections()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_google_calendar_connections on public.google_calendar_connections;
create trigger trg_touch_google_calendar_connections
  before update on public.google_calendar_connections
  for each row execute function public.touch_google_calendar_connections();
