-- Módulo de sueldos / nómina.
-- 1) payroll_items: ítems puntuales que se le suman a la nómina de una persona
--    en un período (comisiones de cierre, extras, ajustes). El cálculo base
--    (CM/diseño/edición/media buyer/override) se deriva del modelo de tarifas y
--    no se persiste acá: solo los ítems manuales/comisiones.
-- 2) media buyer por cuenta: a quién se le paga la gestión de campañas Meta de
--    esa cuenta y si aplica (toggle). La gestión básica de Meta hoy va incluida
--    en el servicio de gestión de redes (la da Guille); a futuro un media buyer
--    pro podría tomar cuentas puntuales.

-- ── payroll_items ──────────────────────────────────────────────────────────
create table if not exists public.payroll_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  periodo       text not null,                     -- YYYY-MM
  tipo          text not null default 'extra',     -- comision | extra | ajuste
  concepto      text not null,
  monto         numeric(14,2) not null,            -- puede ser negativo (ajuste)
  cliente_id    uuid references public.clients(id) on delete set null,
  notas         text,
  creado_por_id uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_payroll_items_periodo on public.payroll_items(periodo);
create index if not exists idx_payroll_items_user on public.payroll_items(user_id);

drop trigger if exists trg_payroll_items_updated on public.payroll_items;
create trigger trg_payroll_items_updated before update on public.payroll_items
  for each row execute function public.set_updated_at();

-- Acceso: solo admin vía service_role (la página entra con createAdmin tras
-- requireRole(['admin'])). Sin policies → RLS bloquea a todos los demás.
alter table public.payroll_items enable row level security;

-- ── media buyer por cuenta (en el servicio paid_media) ──────────────────────
alter table public.client_services
  add column if not exists media_buyer_user_id uuid references public.users(id) on delete set null,
  add column if not exists media_buyer_aplica boolean not null default true;

comment on column public.client_services.media_buyer_user_id is
  'Persona a la que se le paga la gestión de campañas (media buyer) de esta cuenta. Null → usuario con rol paid_media.';
comment on column public.client_services.media_buyer_aplica is
  'Si la nómina debe computar el costo de media buyer para esta cuenta.';

-- Backfill: en los servicios paid_media existentes, asignar al responsable
-- cargado (responsables[0]) o, si está vacío, al usuario con rol paid_media.
update public.client_services s
set media_buyer_user_id = coalesce(
  (s.responsables)[1],
  (select u.id from public.users u where u.rol = 'paid_media' and u.activo order by u.created_at limit 1)
)
where s.tipo = 'paid_media' and s.media_buyer_user_id is null;
