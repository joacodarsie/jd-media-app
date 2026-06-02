-- Tipo de facturación por servicio: recurrente (mensual) vs cobro único.
-- Servicios como branding estratégico o desarrollo web se cobran una sola vez,
-- no se deben auto-facturar todos los meses.

alter table public.client_services
  add column if not exists facturacion text not null default 'mensual'
    check (facturacion in ('mensual', 'unico'));

comment on column public.client_services.facturacion is
  'mensual = cobro recurrente cada mes; unico = cobro de única vez (no se auto-factura mensualmente).';

-- El generador de facturas del mes debe saltear los servicios de cobro único:
-- esos se facturan una sola vez (manual / al alta), no cada período.
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
      and coalesce(s.facturacion, 'mensual') = 'mensual'
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
