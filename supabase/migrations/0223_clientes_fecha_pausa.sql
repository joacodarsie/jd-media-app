-- Fecha en que una cuenta pasó a EN PAUSA (28/10/2026).
--
-- Sueldos necesita saber desde cuándo está frenada una cuenta: el mes en que se
-- pausa se paga solo el contenido que se terminó de publicar, y los meses
-- anteriores se liquidan enteros. Para perdido ya está fecha_inactivado; para
-- en_pausa no había nada, así que Blasco (pausado el 20/10) desaparecía también
-- de septiembre, que sí se trabajó.
--
-- Columna aparte y no fecha_inactivado: una pausa no es una baja, y Captación y
-- Objetivos cuentan las bajas con esa fecha.

alter table public.clients
  add column if not exists fecha_pausa timestamptz;

comment on column public.clients.fecha_pausa is
  'Cuándo pasó a en_pausa. Se limpia al volver a activo. La usa Sueldos.';

-- Las pausadas de hoy: la última edición es la mejor aproximación que hay.
update public.clients
  set fecha_pausa = updated_at
  where estado = 'en_pausa' and fecha_pausa is null;

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
      new.fecha_pausa := null;
    end if;
    if new.estado in ('perdido','at_risk') and old.estado not in ('perdido','at_risk') then
      new.fecha_inactivado := now();
    end if;
    if new.estado = 'en_pausa' then
      new.fecha_pausa := now();
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.jd_clients_track_status() from anon, authenticated, public;
