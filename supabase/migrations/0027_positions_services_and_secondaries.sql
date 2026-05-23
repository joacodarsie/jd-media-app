-- Tanda C: vincular puestos con servicios y permitir puestos secundarios.

-- 1) Servicios en los que participa un puesto (slugs del catálogo public.services)
alter table public.positions
  add column if not exists services text[] not null default '{}'::text[];

-- 2) Crear Directora Creativa si no existe (puesto que Bri va a tener como principal)
insert into public.positions (nombre, area, descripcion, services)
values (
  'Directora Creativa',
  'Estrategia/Dirección',
  'Coordina el área creativa y aprueba contenidos del servicio de gestión de redes antes de que vayan al cliente.',
  array['gestion_redes','diseno_grafico','produccion_contenido']
)
on conflict (nombre) do update set
  area = excluded.area,
  descripcion = coalesce(excluded.descripcion, public.positions.descripcion),
  services = case
    when array_length(public.positions.services, 1) is null then excluded.services
    else public.positions.services
  end;

-- 3) Backfill: asociar puestos existentes a sus servicios (best-effort por área)
update public.positions
set services = array['gestion_redes']
where nombre = 'Community Manager' and array_length(services, 1) is null;

update public.positions
set services = array['gestion_redes','diseno_grafico']
where nombre in ('Diseñador/a') and array_length(services, 1) is null;

update public.positions
set services = array['gestion_redes','produccion_contenido']
where nombre = 'Editor/a Audiovisual' and array_length(services, 1) is null;

update public.positions
set services = array['paid_media']
where nombre = 'Paid Media' and array_length(services, 1) is null;

update public.positions
set services = array['desarrollo_web']
where nombre = 'Desarrollador/a Web' and array_length(services, 1) is null;

update public.positions
set services = array['botly']
where nombre = 'Botly' and array_length(services, 1) is null;

-- 4) Puestos secundarios por usuario (un miembro puede ayudar en más de un puesto)
alter table public.users
  add column if not exists secondary_position_ids uuid[] not null default '{}'::uuid[];

create index if not exists idx_users_secondary_positions on public.users using gin (secondary_position_ids);
