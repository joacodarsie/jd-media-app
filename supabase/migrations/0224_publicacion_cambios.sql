-- Registro de cambios del calendario (30/10/2026, pedido del dueño): cada vez
-- que una pieza cambia de fecha o de etapa queda anotado quién, cuándo, de qué
-- a qué y, si es la fecha, cuántos días se corrió. Con eso la plataforma
-- aprende dónde no se respetan los tiempos (qué cuentas y quiénes corren más
-- las piezas, y cuántos cambios son de último momento).
--
-- Quién: si el cambio viene con sesión, auth.uid(); si viene del servidor
-- (clave de servicio), la app pone `editado_por_id` en la misma actualización.
-- El trigger lo lee y lo vuelve a dejar vacío, así un cambio automático
-- posterior (cron) no se le atribuye a la última persona.

alter table public.publications
  add column if not exists editado_por_id uuid references public.users(id) on delete set null;

create table if not exists public.publicacion_cambios (
  id             uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  cliente_id     uuid references public.clients(id) on delete set null,
  user_id        uuid references public.users(id) on delete set null,
  campo          text not null check (campo in ('fecha', 'estado')),
  antes          text,
  despues        text,
  -- Fecha: días que se corrió (positivo = más tarde).
  dias           integer,
  -- Fecha: se cambió con menos de 48 h o con la fecha ya pasada.
  -- Etapa: se llegó a esa etapa con la fecha de publicación ya pasada.
  tarde          boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_publicacion_cambios_pub on public.publicacion_cambios(publication_id, created_at desc);
create index if not exists idx_publicacion_cambios_cliente on public.publicacion_cambios(cliente_id, created_at desc);

-- Solo se lee desde el servidor (service_role).
alter table public.publicacion_cambios enable row level security;

create or replace function public.jd_registrar_cambio_publicacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  v_actor := coalesce(
    auth.uid(),
    case when new.editado_por_id is distinct from old.editado_por_id then new.editado_por_id end
  );

  if new.fecha_publicacion is distinct from old.fecha_publicacion then
    insert into public.publicacion_cambios (publication_id, cliente_id, user_id, campo, antes, despues, dias, tarde)
    values (
      new.id, new.cliente_id, v_actor, 'fecha',
      to_char(old.fecha_publicacion at time zone 'America/Argentina/Cordoba', 'YYYY-MM-DD HH24:MI'),
      to_char(new.fecha_publicacion at time zone 'America/Argentina/Cordoba', 'YYYY-MM-DD HH24:MI'),
      case when old.fecha_publicacion is not null and new.fecha_publicacion is not null
           then (new.fecha_publicacion at time zone 'America/Argentina/Cordoba')::date
              - (old.fecha_publicacion at time zone 'America/Argentina/Cordoba')::date end,
      old.fecha_publicacion is not null and old.fecha_publicacion < now() + interval '48 hours'
    );
  end if;

  if new.estado is distinct from old.estado then
    insert into public.publicacion_cambios (publication_id, cliente_id, user_id, campo, antes, despues, tarde)
    values (
      new.id, new.cliente_id, v_actor, 'estado', old.estado::text, new.estado::text,
      new.fecha_publicacion is not null and new.fecha_publicacion < now()
        and new.estado::text not in ('publicado', 'rechazado')
    );
  end if;

  -- Se usa una sola vez: el próximo cambio sin firma no se le atribuye a nadie.
  new.editado_por_id := null;
  return new;
end;
$$;

drop trigger if exists trg_publicacion_cambios on public.publications;
create trigger trg_publicacion_cambios
  before update on public.publications
  for each row execute function public.jd_registrar_cambio_publicacion();
