-- Accesos rápidos: links externos que el equipo usa día a día (Drive, IG, Botly, etc.)
-- Visibles para todos los autenticados. Solo staff (admin/coordinador) edita.

create table if not exists public.quick_links (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  url         text not null,
  icon        text,
  orden       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_quick_links_updated on public.quick_links;
create trigger trg_quick_links_updated before update on public.quick_links
  for each row execute function public.set_updated_at();

alter table public.quick_links enable row level security;

drop policy if exists quick_links_select on public.quick_links;
create policy quick_links_select on public.quick_links
  for select to authenticated using (true);

drop policy if exists quick_links_write on public.quick_links;
create policy quick_links_write on public.quick_links
  for all to authenticated
  using (public.jd_is_staff())
  with check (public.jd_is_staff());

create index if not exists idx_quick_links_orden on public.quick_links(orden);
