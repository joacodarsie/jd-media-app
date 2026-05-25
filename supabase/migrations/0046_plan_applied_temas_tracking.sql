-- Tracking per-tema: que indices del plan ya fueron aplicados al calendario.
alter table public.client_content_plans
  add column if not exists applied_temas_indices int[] not null default '{}';

-- Link 1:1 entre tema del plan y publication generada.
alter table public.publications
  add column if not exists from_plan_tema_idx int;

create index if not exists idx_publications_from_plan_tema
  on public.publications (from_plan_id, from_plan_tema_idx)
  where from_plan_id is not null;
