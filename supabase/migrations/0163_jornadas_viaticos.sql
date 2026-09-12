-- Las jornadas de producción registraban un solo número: el monto cobrado.
-- Los viáticos estaban hardcodeados en $25.000 y se descontaban de ese monto
-- antes de repartir, así que:
--
--   · Una jornada a 10 cuadras "gastaba" $25.000 de viáticos que nadie gastó, y
--     el equipo cobraba de menos.
--   · Una jornada en las sierras gastaba mucho más de $25.000, y la diferencia
--     se la comía el reparto.
--   · No se sabía si los viáticos los pagó el cliente o la agencia, que es lo
--     que define si son un costo o un pasamanos.
--
-- Ahora la jornada guarda sus horas y sus viáticos reales. El precio sale de
-- las horas ($50.000 la primera + $25.000 cada extra) y el reparto
-- 50% responsable / 30% acompañante / 20% agencia se hace sobre ese precio,
-- con los viáticos aparte y enteros para quienes los pusieron.

alter table public.production_sessions
  add column if not exists horas numeric(4,1) not null default 1,
  add column if not exists viaticos numeric(14,2) not null default 0,
  add column if not exists viaticos_los_paga text not null default 'agencia';

comment on column public.production_sessions.horas is
  'Duración de la jornada. El precio es $50.000 la primera hora + $25.000 cada extra.';
comment on column public.production_sessions.viaticos is
  'Viáticos reales de la jornada. Van enteros a quienes fueron, aparte del reparto.';
comment on column public.production_sessions.viaticos_los_paga is
  'cliente = se le factura aparte y no es costo de la agencia. agencia = sale de la caja.';

alter table public.production_sessions
  drop constraint if exists production_sessions_viaticos_paga_chk;
alter table public.production_sessions
  add constraint production_sessions_viaticos_paga_chk
  check (viaticos_los_paga in ('cliente', 'agencia'));

-- Las jornadas viejas (si hubiera) seguían el modelo anterior: $25.000 de
-- viáticos incluidos dentro del monto. Se separan para que el histórico no
-- cambie de significado.
update public.production_sessions
set viaticos = 25000,
    horas = greatest(1, round(((monto - 25000 - 50000) / 25000.0) + 1))
where viaticos = 0 and monto >= 75000;

-- Aura "sin testear": el dueño tiene que revisar el nuevo formulario.
insert into public.review_flags (ruta, label, nota)
select '/coordinacion/jornadas',
       'Jornadas con horas y viáticos reales',
       'Cargá una jornada: elegí las horas y poné los viáticos que se gastaron de verdad. Verificá que el reparto 50/30/20 se calcule sobre el precio (sin viáticos) y que los viáticos vayan enteros a quienes fueron.'
where not exists (
  select 1 from public.review_flags
  where ruta = '/coordinacion/jornadas' and approved_at is null
);
