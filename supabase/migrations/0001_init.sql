-- =====================================================================
-- JD Media · Gestión de tareas — Esquema inicial
-- Ejecutar este archivo PRIMERO en Supabase > SQL Editor
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Tipos (enums) ----------
do $$ begin
  create type user_role as enum
    ('admin','coordinador','creativa','community_manager','audiovisual',
     'comercial','paid_media','prospecting','web','botly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum
    ('pendiente','en_progreso','en_revision','completada','bloqueada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('baja','media','alta','urgente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_pack as enum ('Presencia','Crecimiento','Escala');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_status as enum ('activo','at_risk','perdido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum
    ('asignacion','mencion','comentario','proxima_a_vencer','vencida');
exception when duplicate_object then null; end $$;

-- Áreas operativas (texto con validación, más flexible que un enum)
create or replace function public.is_area(v text) returns boolean
language sql immutable as $$
  select v in (
    'Estrategia/Dirección','Coordinación','Diseño','Creativas',
    'Community Manager','Edición Audiovisual','Paid Media','Prospecting',
    'Comercial','Desarrollo Web','Botly'
  );
$$;

-- ---------- Tabla: users (perfil, espejo de auth.users) ----------
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  email       text not null unique,
  rol         user_role not null default 'creativa',
  area        text not null default 'Creativas' check (public.is_area(area)),
  avatar_url  text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Tabla: clients ----------
create table if not exists public.clients (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null,
  rubro                text,
  pack                 client_pack not null default 'Presencia',
  creativa_asignada_id uuid references public.users(id) on delete set null,
  estado               client_status not null default 'activo',
  fecha_inicio         date,
  monto_mensual        numeric(12,2),
  created_at           timestamptz not null default now()
);

-- ---------- Tabla: tasks ----------
create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  descripcion      text,
  asignado_a_id    uuid references public.users(id) on delete set null,
  creado_por_id    uuid references public.users(id) on delete set null,
  cliente_id       uuid references public.clients(id) on delete set null,
  area             text not null default 'Creativas' check (public.is_area(area)),
  prioridad        task_priority not null default 'media',
  estado           task_status not null default 'pendiente',
  fecha_limite     date,
  fecha_completada timestamptz,
  links            jsonb not null default '[]'::jsonb,  -- [{ "label": "...", "url": "..." }]
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_tasks_asignado on public.tasks(asignado_a_id);
create index if not exists idx_tasks_cliente  on public.tasks(cliente_id);
create index if not exists idx_tasks_area     on public.tasks(area);
create index if not exists idx_tasks_estado   on public.tasks(estado);
create index if not exists idx_tasks_limite   on public.tasks(fecha_limite);

-- ---------- Tabla: comments ----------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  contenido  text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_task on public.comments(task_id);

-- ---------- Tabla: notifications ----------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  task_id    uuid references public.tasks(id) on delete cascade,
  tipo       notification_type not null,
  mensaje    text not null,
  leida      boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user on public.notifications(user_id, leida);

-- ---------- updated_at automático ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  if (new.estado = 'completada' and old.estado is distinct from 'completada') then
    new.fecha_completada = now();
  elsif (new.estado <> 'completada') then
    new.fecha_completada = null;
  end if;
  return new;
end $$;

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------- Alta automática de perfil al crear usuario en Auth ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, nombre, rol, area, activo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
    coalesce((new.raw_user_meta_data->>'rol')::user_role, 'creativa'),
    coalesce(nullif(new.raw_user_meta_data->>'area',''), 'Creativas'),
    true
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Notificación automática al asignar una tarea ----------
create or replace function public.notify_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.asignado_a_id is not null
     and new.asignado_a_id is distinct from coalesce(old.asignado_a_id, '00000000-0000-0000-0000-000000000000')
     and new.asignado_a_id is distinct from new.creado_por_id then
    insert into public.notifications (user_id, task_id, tipo, mensaje)
    values (new.asignado_a_id, new.id, 'asignacion',
            'Te asignaron la tarea: ' || new.titulo);
  end if;
  return new;
end $$;

drop trigger if exists trg_task_assignment on public.tasks;
create trigger trg_task_assignment after insert or update of asignado_a_id on public.tasks
  for each row execute function public.notify_assignment();
