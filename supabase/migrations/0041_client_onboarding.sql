-- Onboarding de clientes: datos contractuales + tracking de pasos.

-- 1) Campos contractuales en clients
alter table public.clients
  add column if not exists contacto_dni_cuit          text,
  add column if not exists contacto_domicilio         text,
  add column if not exists contrato_numero            text,
  add column if not exists contrato_fecha_inicio      date,
  add column if not exists contrato_plazo_meses       integer,
  add column if not exists contrato_dia_cobro         integer,
  add column if not exists contrato_moneda            text default 'ARS',
  add column if not exists contrato_descuento_pct     numeric(5,2),
  add column if not exists contrato_descuento_meses   integer,
  add column if not exists contrato_observaciones     text;

-- 2) Secuencia simple para numerar cartas: JD-YYYY-####
create table if not exists public.contract_counters (
  year  int primary key,
  last  int not null default 0
);

create or replace function public.next_contract_number(p_year int)
returns int language plpgsql as $$
declare v_next int;
begin
  insert into public.contract_counters (year, last) values (p_year, 1)
    on conflict (year) do update set last = contract_counters.last + 1
    returning last into v_next;
  return v_next;
end $$;

-- 3) Tabla de tracking del onboarding
create table if not exists public.client_onboarding (
  cliente_id              uuid primary key references public.clients(id) on delete cascade,
  carta_enviada_at        timestamptz,
  pago_recibido_at        timestamptz,
  equipo_asignado_at      timestamptz,
  grupo_wpp_creado_at     timestamptz,
  mensajes_enviados_at    timestamptz,
  tareas_iniciales_at     timestamptz,
  kickoff_agendado_at     timestamptz,
  notas                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

drop trigger if exists trg_co_updated on public.client_onboarding;
create trigger trg_co_updated before update on public.client_onboarding
  for each row execute function public.set_updated_at();

alter table public.client_onboarding enable row level security;

drop policy if exists co_select on public.client_onboarding;
create policy co_select on public.client_onboarding
  for select to authenticated using (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_onboarding.cliente_id
        and (c.creativa_asignada_id = (select auth.uid()) or c.cm_id = (select auth.uid()))
    )
  );

drop policy if exists co_modify on public.client_onboarding;
create policy co_modify on public.client_onboarding
  for all to authenticated
  using (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_onboarding.cliente_id
        and c.creativa_asignada_id = (select auth.uid())
    )
  )
  with check (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_onboarding.cliente_id
        and c.creativa_asignada_id = (select auth.uid())
    )
  );
