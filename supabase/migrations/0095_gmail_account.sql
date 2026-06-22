-- Conexión a la casilla de Gmail de la agencia (una sola, singleton) para traer
-- CVs de los mails al reclutamiento. Tokens sensibles → RLS staff; los escribe el
-- callback OAuth con el service_role.

create table if not exists public.gmail_account (
  id                int primary key default 1 check (id = 1),
  email             text,
  access_token      text not null,
  refresh_token     text not null,
  token_expires_at  timestamptz,
  scope             text,
  connected_at      timestamptz not null default now(),
  last_sync_at      timestamptz,
  created_by        uuid references public.users(id),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_gmail_account_updated on public.gmail_account;
create trigger trg_gmail_account_updated before update on public.gmail_account
  for each row execute function public.set_updated_at();

alter table public.gmail_account enable row level security;

drop policy if exists gmail_account_all on public.gmail_account;
create policy gmail_account_all on public.gmail_account
  for all to authenticated
  using (public.jd_is_staff()) with check (public.jd_is_staff());
