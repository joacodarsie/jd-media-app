-- Deudas de la agencia / personales que afectan la posición real (ej: plata que
-- el dueño debe y tiene que devolver). Permite ver "cómo vengo realmente"
-- descontando lo que se debe, no solo la ganancia del mes.

create table if not exists public.debts (
  id              uuid primary key default gen_random_uuid(),
  acreedor        text not null,            -- a quién se le debe (ej: "Papá")
  monto           numeric(14,2) not null,
  moneda          text not null default 'ARS',
  detalle         text,
  fecha           date,                     -- cuándo se originó (opcional)
  saldada         boolean not null default false,
  fecha_saldada   date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_debts_updated on public.debts;
create trigger trg_debts_updated before update on public.debts
  for each row execute function public.set_updated_at();

alter table public.debts enable row level security;

drop policy if exists debts_select on public.debts;
create policy debts_select on public.debts
  for select to authenticated using (public.jd_is_staff());

drop policy if exists debts_modify on public.debts;
create policy debts_modify on public.debts
  for all to authenticated
  using (public.jd_is_staff()) with check (public.jd_is_staff());
