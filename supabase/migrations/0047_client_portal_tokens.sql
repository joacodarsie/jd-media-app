create table if not exists public.client_portal_tokens (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clients(id) on delete cascade,
  token           text not null unique,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz,
  expires_at      timestamptz,
  revoked_at      timestamptz
);

create index if not exists idx_cpt_token on public.client_portal_tokens (token) where revoked_at is null;
create index if not exists idx_cpt_cliente on public.client_portal_tokens (cliente_id);

alter table public.client_portal_tokens enable row level security;

drop policy if exists cpt_select on public.client_portal_tokens;
create policy cpt_select on public.client_portal_tokens
  for select to authenticated using (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_portal_tokens.cliente_id
        and (c.creativa_asignada_id = (select auth.uid()) or c.cm_id = (select auth.uid()))
    )
  );

drop policy if exists cpt_modify on public.client_portal_tokens;
create policy cpt_modify on public.client_portal_tokens
  for all to authenticated
  using (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_portal_tokens.cliente_id
        and (c.creativa_asignada_id = (select auth.uid()) or c.cm_id = (select auth.uid()))
    )
  )
  with check (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_portal_tokens.cliente_id
        and (c.creativa_asignada_id = (select auth.uid()) or c.cm_id = (select auth.uid()))
    )
  );
