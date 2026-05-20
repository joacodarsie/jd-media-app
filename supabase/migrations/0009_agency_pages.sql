-- Etapa 12-13: paginas internas de agencia + procesos/SOPs editables (markdown CMS simple)
create table if not exists public.agency_pages (
  slug        text primary key,
  title       text not null,
  kind        text not null check (kind in ('fundamentos','buyer_persona','proceso','plantilla','otro')),
  orden       int not null default 0,
  content     text not null,
  notion_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_agency_pages_updated on public.agency_pages;
create trigger trg_agency_pages_updated before update on public.agency_pages
  for each row execute function public.set_updated_at();

alter table public.agency_pages enable row level security;

drop policy if exists agency_select on public.agency_pages;
create policy agency_select on public.agency_pages
  for select to authenticated using (true);

drop policy if exists agency_write on public.agency_pages;
create policy agency_write on public.agency_pages
  for all to authenticated
  using (public.jd_is_staff())
  with check (public.jd_is_staff());

create index if not exists idx_agency_pages_kind_orden on public.agency_pages(kind, orden);
