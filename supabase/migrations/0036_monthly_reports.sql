-- Link a la publicación pública (Instagram/TikTok/etc.) y reporte mensual editable.

alter table public.publications
  add column if not exists link_publicacion text;

create table if not exists public.client_monthly_reports (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clients(id) on delete cascade,
  year_month  text not null check (year_month ~ '^\d{4}-\d{2}$'),
  nota        text,
  metricas    jsonb not null default '{}'::jsonb,
  created_by_id uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (cliente_id, year_month)
);

drop trigger if exists trg_cmr_updated on public.client_monthly_reports;
create trigger trg_cmr_updated before update on public.client_monthly_reports
  for each row execute function public.set_updated_at();

create index if not exists idx_cmr_cliente_mes on public.client_monthly_reports(cliente_id, year_month);

alter table public.client_monthly_reports enable row level security;

drop policy if exists cmr_select on public.client_monthly_reports;
create policy cmr_select on public.client_monthly_reports
  for select to authenticated using (true);

drop policy if exists cmr_write on public.client_monthly_reports;
create policy cmr_write on public.client_monthly_reports
  for all to authenticated
  using (public.jd_is_staff())
  with check (public.jd_is_staff());
