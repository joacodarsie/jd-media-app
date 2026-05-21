-- Sprint 2: módulo de finanzas — cuentas por cobrar (client_invoices) y pagos al equipo (team_payments).

-- ============================
-- client_invoices
-- ============================
create table if not exists public.client_invoices (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references public.clients(id) on delete cascade,
  service_id          uuid references public.client_services(id) on delete set null,
  periodo             text not null,           -- YYYY-MM (ej '2026-05')
  concepto            text not null,
  monto               numeric(14,2) not null,
  moneda              text not null default 'ARS',
  fecha_emision       date not null default (now() at time zone 'America/Argentina/Cordoba')::date,
  fecha_vencimiento   date,
  fecha_cobro         date,
  metodo_pago         text,
  notas               text,
  creado_por_id       uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_invoices_cliente   on public.client_invoices(cliente_id);
create index if not exists idx_invoices_periodo   on public.client_invoices(periodo);
create index if not exists idx_invoices_pagada    on public.client_invoices(fecha_cobro);
create unique index if not exists uq_invoice_per_service_period
  on public.client_invoices(cliente_id, service_id, periodo)
  where service_id is not null;

drop trigger if exists trg_invoices_updated on public.client_invoices;
create trigger trg_invoices_updated before update on public.client_invoices
  for each row execute function public.set_updated_at();

alter table public.client_invoices enable row level security;

drop policy if exists invoices_select on public.client_invoices;
create policy invoices_select on public.client_invoices
  for select to authenticated using (public.jd_is_staff());

drop policy if exists invoices_modify on public.client_invoices;
create policy invoices_modify on public.client_invoices
  for all to authenticated
  using (public.jd_is_staff()) with check (public.jd_is_staff());

-- ============================
-- team_payments
-- ============================
create table if not exists public.team_payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  periodo           text not null,             -- YYYY-MM
  concepto          text not null,
  monto             numeric(14,2) not null,
  moneda            text not null default 'ARS',
  fecha_programada  date not null,
  fecha_pago        date,
  metodo_pago       text,
  notas             text,
  creado_por_id     uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_payments_user     on public.team_payments(user_id);
create index if not exists idx_payments_periodo  on public.team_payments(periodo);
create index if not exists idx_payments_pagada   on public.team_payments(fecha_pago);
create unique index if not exists uq_payment_per_user_period
  on public.team_payments(user_id, periodo, concepto);

drop trigger if exists trg_payments_updated on public.team_payments;
create trigger trg_payments_updated before update on public.team_payments
  for each row execute function public.set_updated_at();

alter table public.team_payments enable row level security;

drop policy if exists payments_select on public.team_payments;
create policy payments_select on public.team_payments
  for select to authenticated using (
    public.jd_is_staff() or user_id = (select auth.uid())
  );

drop policy if exists payments_modify on public.team_payments;
create policy payments_modify on public.team_payments
  for all to authenticated
  using (public.jd_is_staff()) with check (public.jd_is_staff());

-- ============================
-- Helpers: generar mes
-- ============================

-- Genera invoices del período YYYY-MM para cada client_service activo de clientes activos.
-- No duplica: el unique (cliente, service, periodo) lo evita.
create or replace function public.jd_generate_invoices_for_period(p_periodo text)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_due_day integer := 10;  -- vence el día 10 del mes (editable luego por fila)
  v_due_date date;
  v_emit_date date := (p_periodo || '-01')::date;
  rec record;
begin
  if not public.jd_is_staff() then
    raise exception 'solo staff';
  end if;

  v_due_date := (p_periodo || '-' || lpad(v_due_day::text, 2, '0'))::date;

  for rec in
    select s.id as service_id, s.cliente_id, s.tipo, s.pack, s.monto_mensual, s.moneda, c.nombre as cliente_nombre
    from public.client_services s
    join public.clients c on c.id = s.cliente_id
    where s.activo = true
      and s.monto_mensual is not null
      and c.estado = 'activo'
  loop
    begin
      insert into public.client_invoices(
        cliente_id, service_id, periodo, concepto, monto, moneda,
        fecha_emision, fecha_vencimiento, creado_por_id
      ) values (
        rec.cliente_id, rec.service_id, p_periodo,
        rec.cliente_nombre || ' · ' || rec.tipo
          || coalesce(' (' || rec.pack || ')', '')
          || ' — ' || p_periodo,
        rec.monto_mensual, rec.moneda,
        v_emit_date, v_due_date, auth.uid()
      );
      v_count := v_count + 1;
    exception when unique_violation then
      null; -- ya existía, lo ignoramos
    end;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.jd_generate_invoices_for_period(text) to authenticated;

-- Genera team_payments del período YYYY-MM para cada user activo con compensación recurrente.
create or replace function public.jd_generate_payments_for_period(p_periodo text)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_due_day integer := 5;  -- fecha programada de pago día 5 del mes siguiente al período
  v_year integer;
  v_month integer;
  v_due_date date;
  rec record;
  v_monto numeric;
  v_moneda text;
  v_freq text;
begin
  if not public.jd_is_staff() then
    raise exception 'solo staff';
  end if;

  v_year := split_part(p_periodo, '-', 1)::int;
  v_month := split_part(p_periodo, '-', 2)::int;
  -- pagar el día 5 del mes SIGUIENTE
  if v_month = 12 then
    v_due_date := make_date(v_year + 1, 1, v_due_day);
  else
    v_due_date := make_date(v_year, v_month + 1, v_due_day);
  end if;

  for rec in
    select u.id as user_id, u.nombre, u.position_id,
           comp.monto as c_monto, comp.moneda as c_moneda, comp.frecuencia as c_freq,
           pos.pago_default_monto as p_monto, pos.pago_default_moneda as p_moneda,
           pos.pago_default_frecuencia as p_freq
    from public.users u
    left join public.compensation comp on comp.user_id = u.id
    left join public.positions pos on pos.id = u.position_id
    where u.activo = true
  loop
    -- override > default del puesto
    v_monto  := coalesce(rec.c_monto, rec.p_monto);
    v_moneda := coalesce(rec.c_moneda, rec.p_moneda, 'ARS');
    v_freq   := coalesce(rec.c_freq,  rec.p_freq,  'mensual');

    -- saltear si no hay monto o si no es recurrente (proyecto/comision/por_tarea se cargan a mano)
    if v_monto is null then continue; end if;
    if v_freq not in ('mensual','quincenal','semanal') then continue; end if;

    begin
      insert into public.team_payments(
        user_id, periodo, concepto, monto, moneda,
        fecha_programada, creado_por_id
      ) values (
        rec.user_id, p_periodo,
        'Compensación ' || v_freq || ' — ' || p_periodo,
        case v_freq
          when 'quincenal' then v_monto * 2
          when 'semanal'   then round(v_monto * 4.33, 2)
          else v_monto
        end,
        v_moneda,
        v_due_date, auth.uid()
      );
      v_count := v_count + 1;
    exception when unique_violation then
      null;
    end;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.jd_generate_payments_for_period(text) to authenticated;
