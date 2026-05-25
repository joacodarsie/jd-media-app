-- Tracking de aplicacion del Plan al calendario
alter table public.client_content_plans
  add column if not exists applied_at timestamptz,
  add column if not exists applied_count int;

alter table public.publications
  add column if not exists from_plan_id uuid references public.client_content_plans(id) on delete set null;

create index if not exists idx_publications_from_plan
  on public.publications (from_plan_id);
