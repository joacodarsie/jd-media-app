-- C10: historial de cambios en client_services.
-- Cada INSERT/UPDATE/DELETE deja un snapshot.

create table if not exists public.client_services_history (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid,                                          -- puede quedar null si se borra
  cliente_id   uuid not null references public.clients(id) on delete cascade,
  accion       text not null check (accion in ('created','updated','deleted')),
  snapshot     jsonb not null,                                -- fila completa al momento
  cambios      jsonb,                                         -- diff con la versión anterior (en updates)
  user_id      uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_csh_service on public.client_services_history(service_id, created_at desc);
create index if not exists idx_csh_cliente on public.client_services_history(cliente_id, created_at desc);

alter table public.client_services_history enable row level security;

drop policy if exists csh_select on public.client_services_history;
create policy csh_select on public.client_services_history
  for select to authenticated using (public.jd_is_staff());

create or replace function public.jd_track_service_changes() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_changes jsonb := '{}'::jsonb;
  v_snapshot jsonb;
begin
  if tg_op = 'INSERT' then
    v_snapshot := to_jsonb(new);
    insert into public.client_services_history(service_id, cliente_id, accion, snapshot, user_id)
    values (new.id, new.cliente_id, 'created', v_snapshot, v_user);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- detectar campos cambiados (solo los que importan)
    if new.tipo is distinct from old.tipo then
      v_changes := v_changes || jsonb_build_object('tipo', jsonb_build_object('antes', old.tipo, 'despues', new.tipo));
    end if;
    if new.pack is distinct from old.pack then
      v_changes := v_changes || jsonb_build_object('pack', jsonb_build_object('antes', old.pack, 'despues', new.pack));
    end if;
    if new.monto_mensual is distinct from old.monto_mensual then
      v_changes := v_changes || jsonb_build_object('monto_mensual', jsonb_build_object('antes', old.monto_mensual, 'despues', new.monto_mensual));
    end if;
    if new.moneda is distinct from old.moneda then
      v_changes := v_changes || jsonb_build_object('moneda', jsonb_build_object('antes', old.moneda, 'despues', new.moneda));
    end if;
    if new.fecha_inicio is distinct from old.fecha_inicio then
      v_changes := v_changes || jsonb_build_object('fecha_inicio', jsonb_build_object('antes', old.fecha_inicio, 'despues', new.fecha_inicio));
    end if;
    if new.fecha_fin is distinct from old.fecha_fin then
      v_changes := v_changes || jsonb_build_object('fecha_fin', jsonb_build_object('antes', old.fecha_fin, 'despues', new.fecha_fin));
    end if;
    if new.activo is distinct from old.activo then
      v_changes := v_changes || jsonb_build_object('activo', jsonb_build_object('antes', old.activo, 'despues', new.activo));
    end if;
    if new.pack_detalle is distinct from old.pack_detalle then
      v_changes := v_changes || jsonb_build_object('pack_detalle', jsonb_build_object('antes', old.pack_detalle, 'despues', new.pack_detalle));
    end if;
    if new.notas is distinct from old.notas then
      v_changes := v_changes || jsonb_build_object('notas', jsonb_build_object('antes', old.notas, 'despues', new.notas));
    end if;

    -- si no cambió nada relevante, no logueamos (evita ruido por touch de updated_at)
    if v_changes = '{}'::jsonb then
      return new;
    end if;

    v_snapshot := to_jsonb(new);
    insert into public.client_services_history(service_id, cliente_id, accion, snapshot, cambios, user_id)
    values (new.id, new.cliente_id, 'updated', v_snapshot, v_changes, v_user);
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_snapshot := to_jsonb(old);
    insert into public.client_services_history(service_id, cliente_id, accion, snapshot, user_id)
    values (null, old.cliente_id, 'deleted', v_snapshot, v_user);
    return old;
  end if;

  return null;
end;
$$;

revoke execute on function public.jd_track_service_changes() from anon, authenticated, public;

drop trigger if exists trg_client_services_history on public.client_services;
create trigger trg_client_services_history
  after insert or update or delete on public.client_services
  for each row execute function public.jd_track_service_changes();
