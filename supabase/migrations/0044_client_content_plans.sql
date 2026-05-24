-- Plan de contenido mensual por cliente.
-- Es la "estrategia operativa" recurrente: mix por red, distribucion por pilar,
-- temas destacados del mes, campanas. Separado del diagnostico porque cambia
-- mas seguido (mensual) mientras el diagnostico es mas estable (trimestral+).

create table if not exists public.client_content_plans (
  id                      uuid primary key default gen_random_uuid(),
  cliente_id              uuid not null references public.clients(id) on delete cascade,
  -- Etiqueta humana del periodo, ej: "Mayo 2026", "Q2 2026", "Lanzamiento del album".
  periodo_label           text not null,
  status                  text not null default 'draft'
                            check (status in ('draft', 'active', 'archived')),
  content                 jsonb not null default '{}'::jsonb,
  generated_with_model    text,
  generated_at            timestamptz,
  approved_at             timestamptz,
  approved_by             uuid references auth.users(id),
  created_by              uuid references auth.users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_ccp_cliente
  on public.client_content_plans (cliente_id, status, created_at desc);

create index if not exists idx_ccp_active
  on public.client_content_plans (cliente_id)
  where status = 'active';

drop trigger if exists trg_ccp_updated on public.client_content_plans;
create trigger trg_ccp_updated before update on public.client_content_plans
  for each row execute function public.set_updated_at();

-- RLS: staff full access, asignados del cliente (creativa/cm) pueden ver y editar.
alter table public.client_content_plans enable row level security;

drop policy if exists ccp_select on public.client_content_plans;
create policy ccp_select on public.client_content_plans
  for select to authenticated using (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_content_plans.cliente_id
        and (c.creativa_asignada_id = (select auth.uid()) or c.cm_id = (select auth.uid()))
    )
  );

drop policy if exists ccp_modify on public.client_content_plans;
create policy ccp_modify on public.client_content_plans
  for all to authenticated
  using (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_content_plans.cliente_id
        and (c.creativa_asignada_id = (select auth.uid()) or c.cm_id = (select auth.uid()))
    )
  )
  with check (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_content_plans.cliente_id
        and (c.creativa_asignada_id = (select auth.uid()) or c.cm_id = (select auth.uid()))
    )
  );
