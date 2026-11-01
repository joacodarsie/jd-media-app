-- Conciliación automática con la planilla del dueño (1/11/2026).
--
-- Cada cobro de cliente o sueldo que la planilla "Finanzas de Joaquín" detecta
-- en el banco llega acá, la app lo marca (cobrado / pagado) y queda esperando
-- que el dueño confirme. `efecto` guarda qué se cambió, para poder deshacerlo.
-- `clave` es la del movimiento en la planilla: el mismo nunca se aplica dos veces.

create table if not exists public.movimientos_planilla (
  clave text primary key,
  fecha date not null,
  monto numeric not null,
  tipo text not null check (tipo in ('cobro', 'sueldo')),
  detalle text,
  descripcion text,
  cuenta text,
  estado text not null default 'marcado'
    check (estado in ('marcado', 'sin_match', 'omitido', 'confirmado', 'deshecho')),
  mensaje text,
  user_id uuid references public.users (id) on delete set null,
  periodo text,
  efecto jsonb,
  created_at timestamptz not null default now(),
  revisado_at timestamptz,
  revisado_por_id uuid references public.users (id) on delete set null
);

create index if not exists movimientos_planilla_estado_idx on public.movimientos_planilla (estado, created_at desc);

alter table public.movimientos_planilla enable row level security;
revoke all on public.movimientos_planilla from anon, authenticated;
