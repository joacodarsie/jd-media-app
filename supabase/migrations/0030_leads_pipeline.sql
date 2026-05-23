-- Pipeline comercial / CRM básico para Sol y Gonzalo.
-- Cada lead pasa por stages hasta convertirse en cliente (ganado) o caer (perdido).

do $$ begin
  create type lead_stage as enum (
    'nuevo',
    'contactado',
    'calificado',
    'propuesta',
    'negociacion',
    'ganado',
    'perdido'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.leads (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  empresa             text,
  email               text,
  telefono            text,
  origen              text,
  servicio_interesado text references public.services(slug) on delete set null,
  monto_estimado      numeric(12,2),
  moneda              text not null default 'ARS' check (moneda in ('ARS','USD','EUR')),
  stage               lead_stage not null default 'nuevo',
  asignado_a_id       uuid references public.users(id) on delete set null,
  notas               text,
  proxima_accion      text,
  proxima_accion_at   timestamptz,
  ganado_cliente_id   uuid references public.clients(id) on delete set null,
  perdido_motivo      text,
  orden               int not null default 0,
  created_by_id       uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

create index if not exists idx_leads_stage_orden on public.leads(stage, orden);
create index if not exists idx_leads_asignado on public.leads(asignado_a_id);
create index if not exists idx_leads_updated on public.leads(updated_at desc);

alter table public.leads enable row level security;

-- Todos los staff (admin/coordinador/comercial/prospecting) leen y escriben.
-- El resto puede ver solo los leads que tiene asignados.
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (
    public.jd_is_staff()
    or asignado_a_id = (select auth.uid())
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.rol in ('comercial','prospecting')
    )
  );

drop policy if exists leads_write on public.leads;
create policy leads_write on public.leads
  for all to authenticated
  using (
    public.jd_is_staff()
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.rol in ('comercial','prospecting')
    )
  )
  with check (
    public.jd_is_staff()
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.rol in ('comercial','prospecting')
    )
  );
