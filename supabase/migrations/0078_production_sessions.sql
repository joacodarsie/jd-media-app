-- Jornadas de producción de contenido.
-- JD Media cobra una jornada de producción (filmación/foto presencial, sobre todo
-- para clientes de Córdoba). El monto cobrado se reparte en partes iguales entre
-- las personas del equipo que asistieron, y ese reparto se suma a la nómina del
-- mes correspondiente (período derivado de la fecha de la jornada).
--
-- La nómina (sueldos) lee estas filas y calcula el split por persona al vuelo
-- (no se persiste en payroll_items): así editar/borrar una jornada actualiza la
-- nómina sin dejar ítems huérfanos.

create table if not exists public.production_sessions (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null,
  periodo       text not null,                       -- 'YYYY-MM' (derivado de fecha)
  monto         numeric(14,2) not null default 50000, -- monto total cobrado por la jornada
  cliente_id    uuid references public.clients(id) on delete set null,
  lugar         text,                                -- ej: "Córdoba Capital"
  notas         text,
  asistentes    uuid[] not null default '{}',        -- user_ids que asistieron y cobran
  creado_por_id uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_production_sessions_periodo on public.production_sessions(periodo);

drop trigger if exists trg_production_sessions_updated on public.production_sessions;
create trigger trg_production_sessions_updated before update on public.production_sessions
  for each row execute function public.set_updated_at();

-- Acceso: solo admin vía service_role (la página entra con createAdmin tras
-- requireRole(['admin'])). Sin policies → RLS bloquea a todos los demás.
alter table public.production_sessions enable row level security;
