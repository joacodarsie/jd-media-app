-- Sprint 3 — A2: registrar fechas de activación/inactivación + renombrar lógicamente
-- "perdido" como "inactivo" (mantenemos el enum value por compat, pero la UI muestra "inactivo")
alter table public.clients
  add column if not exists fecha_activado timestamptz,
  add column if not exists fecha_inactivado timestamptz;

-- Backfill: clientes activos hoy → asumir activos desde su created_at
update public.clients
  set fecha_activado = coalesce(fecha_activado, created_at)
  where estado = 'activo' and fecha_activado is null;

-- Clientes perdidos hoy → asumir activos desde created_at e inactivos a updated_at
update public.clients
  set fecha_activado = coalesce(fecha_activado, created_at),
      fecha_inactivado = coalesce(fecha_inactivado, updated_at)
  where estado in ('perdido','at_risk') and fecha_inactivado is null;

-- Trigger: cada cambio de estado actualiza la fecha correspondiente
create or replace function public.jd_clients_track_status() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado = 'activo' then
      new.fecha_activado := coalesce(new.fecha_activado, now());
    end if;
    if new.estado in ('perdido','at_risk') then
      new.fecha_inactivado := coalesce(new.fecha_inactivado, now());
    end if;
    return new;
  end if;

  if new.estado is distinct from old.estado then
    if new.estado = 'activo' then
      new.fecha_activado := coalesce(new.fecha_activado, now());
      new.fecha_inactivado := null;
    end if;
    if new.estado in ('perdido','at_risk') and old.estado not in ('perdido','at_risk') then
      new.fecha_inactivado := now();
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.jd_clients_track_status() from anon, authenticated, public;

drop trigger if exists trg_clients_status_dates on public.clients;
create trigger trg_clients_status_dates
  before insert or update of estado on public.clients
  for each row execute function public.jd_clients_track_status();

-- A3: publication — resubido a TikTok + URL publicada
alter table public.publications
  add column if not exists resubido_tiktok boolean not null default false,
  add column if not exists publicacion_url text;

-- A6: clientes — links libres, redes sociales libres y credenciales
-- Usamos JSONB para ser flexibles (arrays con structuras simples)
alter table public.clients
  add column if not exists links_custom jsonb not null default '[]'::jsonb,
  add column if not exists redes_sociales jsonb not null default '[]'::jsonb,
  add column if not exists credenciales jsonb not null default '[]'::jsonb;

-- Migrar lo existente de instagram_url/facebook_url/web_url a redes_sociales si están cargados.
-- (Las columnas viejas las mantenemos por compat).
update public.clients
  set redes_sociales = coalesce(redes_sociales, '[]'::jsonb)
    || case when instagram_url is not null and instagram_url <> ''
            then jsonb_build_array(jsonb_build_object('red','instagram','url',instagram_url))
            else '[]'::jsonb end
    || case when facebook_url is not null and facebook_url <> ''
            then jsonb_build_array(jsonb_build_object('red','facebook','url',facebook_url))
            else '[]'::jsonb end
    || case when web_url is not null and web_url <> ''
            then jsonb_build_array(jsonb_build_object('red','web','url',web_url))
            else '[]'::jsonb end
  where redes_sociales = '[]'::jsonb
    and (instagram_url is not null or facebook_url is not null or web_url is not null);
