-- Historial de la pausa (28/10/2026): al reactivar una cuenta pausada NO se
-- borra cuándo se pausó; se anota cuándo volvió. La 0223 limpiaba fecha_pausa
-- al volver a activo y se perdía el registro.
--
-- Sueldos usa el tramo pausa → reactivación: los meses del medio no generan
-- nómina; el de la pausa paga solo el contenido publicado.
-- Se guarda la última pausa; si se pausa de nuevo, se pisa.

alter table public.clients
  add column if not exists fecha_reactivacion timestamptz;

comment on column public.clients.fecha_reactivacion is
  'Cuándo volvió a activo después de la última pausa (fecha_pausa). La usa Sueldos.';

comment on column public.clients.fecha_pausa is
  'Cuándo pasó a en_pausa la última vez. No se borra al reactivar (ver fecha_reactivacion). La usa Sueldos.';

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
    if new.estado = 'en_pausa' then
      new.fecha_pausa := coalesce(new.fecha_pausa, now());
    end if;
    return new;
  end if;

  if new.estado is distinct from old.estado then
    if new.estado = 'activo' then
      new.fecha_activado := coalesce(new.fecha_activado, now());
      new.fecha_inactivado := null;
      if old.estado = 'en_pausa' then
        new.fecha_reactivacion := now();
      end if;
    end if;
    if new.estado in ('perdido','at_risk') and old.estado not in ('perdido','at_risk') then
      new.fecha_inactivado := now();
    end if;
    if new.estado = 'en_pausa' then
      new.fecha_pausa := now();
      new.fecha_reactivacion := null;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.jd_clients_track_status() from anon, authenticated, public;
