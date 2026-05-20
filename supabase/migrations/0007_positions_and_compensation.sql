-- Etapa 7: puestos + compensacion hibrida
create table if not exists public.positions (
  id                       uuid primary key default gen_random_uuid(),
  nombre                   text not null unique,
  area                     text not null,
  descripcion              text,
  alcance_incluye          text,
  alcance_excluye          text,
  herramientas             jsonb not null default '[]'::jsonb,
  kpis                     text,
  procesos                 text,
  pago_default_monto       numeric(12,2),
  pago_default_moneda      text default 'ARS' check (pago_default_moneda in ('ARS','USD','EUR')),
  pago_default_frecuencia  text default 'mensual' check (pago_default_frecuencia in ('mensual','quincenal','semanal','proyecto','comision','por_tarea')),
  pago_default_forma       text,
  pago_default_notas       text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists trg_positions_updated on public.positions;
create trigger trg_positions_updated before update on public.positions
  for each row execute function public.set_updated_at();

alter table public.users
  add column if not exists position_id uuid references public.positions(id) on delete set null;

create index if not exists idx_users_position on public.users(position_id);

create table if not exists public.compensation (
  user_id    uuid primary key references public.users(id) on delete cascade,
  monto      numeric(12,2),
  moneda     text default 'ARS' check (moneda in ('ARS','USD','EUR')),
  frecuencia text check (frecuencia in ('mensual','quincenal','semanal','proyecto','comision','por_tarea')),
  forma_pago text,
  notas      text,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_compensation_updated on public.compensation;
create trigger trg_compensation_updated before update on public.compensation
  for each row execute function public.set_updated_at();

alter table public.positions enable row level security;
alter table public.compensation enable row level security;

drop policy if exists positions_select on public.positions;
create policy positions_select on public.positions
  for select to authenticated using (true);

drop policy if exists positions_admin on public.positions;
create policy positions_admin on public.positions
  for all to authenticated
  using (public.jd_role() = 'admin')
  with check (public.jd_role() = 'admin');

drop policy if exists compensation_select on public.compensation;
create policy compensation_select on public.compensation
  for select to authenticated
  using (user_id = (select auth.uid()) or public.jd_role() = 'admin');

drop policy if exists compensation_admin on public.compensation;
create policy compensation_admin on public.compensation
  for all to authenticated
  using (public.jd_role() = 'admin')
  with check (public.jd_role() = 'admin');

insert into public.positions (nombre, area, descripcion) values
  ('Director/a', 'Estrategia/Dirección', 'Dirección general de la agencia.'),
  ('Coordinador/a', 'Coordinación', 'Coordinación operativa de equipos y clientes.'),
  ('Diseñador/a', 'Diseño', 'Producción gráfica y branding.'),
  ('Community Manager', 'Community Manager', 'Gestión de redes sociales del cliente.'),
  ('Creativa', 'Creativas', 'Estrategia creativa y conceptos de campaña.'),
  ('Editor/a Audiovisual', 'Edición Audiovisual', 'Edición de reels, videos y piezas audiovisuales.'),
  ('Paid Media', 'Paid Media', 'Gestión y optimización de campañas pagas.'),
  ('Prospecting', 'Prospecting', 'Generación de leads y prospección B2B.'),
  ('Comercial', 'Comercial', 'Cierre de ventas y atención de cuenta.'),
  ('Desarrollador/a Web', 'Desarrollo Web', 'Desarrollo y mantenimiento de sitios.'),
  ('Botly', 'Botly', 'Diseño e implementación de bots conversacionales.')
on conflict (nombre) do nothing;

update public.users u
set position_id = p.id
from public.positions p
where u.position_id is null and u.area = p.area;
