-- Conexión de TikTok por cliente (OAuth v2). A diferencia de Instagram (system
-- user token de Meta), TikTok exige que cada cuenta autorice por separado, así
-- que guardamos un token por cliente. Los tokens son sensibles → tabla RLS-only
-- (solo service_role / staff los lee; nunca se exponen al cliente).

create table if not exists public.client_tiktok_accounts (
  cliente_id        uuid primary key references public.clients(id) on delete cascade,
  open_id           text not null,            -- id estable de la cuenta en TikTok
  username          text,
  display_name      text,
  avatar_url        text,
  access_token      text not null,
  refresh_token     text not null,
  token_expires_at  timestamptz,              -- vencimiento del access_token
  refresh_expires_at timestamptz,             -- vencimiento del refresh_token
  scope             text,
  connected_at      timestamptz not null default now(),
  last_sync_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_client_tiktok_updated on public.client_tiktok_accounts;
create trigger trg_client_tiktok_updated before update on public.client_tiktok_accounts
  for each row execute function public.set_updated_at();

alter table public.client_tiktok_accounts enable row level security;

-- Solo staff lee/gestiona (el cliente nunca ve tokens). El callback OAuth y los
-- sync escriben con el service_role, que saltea RLS.
drop policy if exists tiktok_select on public.client_tiktok_accounts;
create policy tiktok_select on public.client_tiktok_accounts
  for select to authenticated using (public.jd_is_staff());

drop policy if exists tiktok_modify on public.client_tiktok_accounts;
create policy tiktok_modify on public.client_tiktok_accounts
  for all to authenticated
  using (public.jd_is_staff()) with check (public.jd_is_staff());
