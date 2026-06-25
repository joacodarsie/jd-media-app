-- Fix: al mover la fecha de un posteo en el calendario, la tarea vinculada
-- (diseño/edición) NO actualizaba su fecha límite → a la diseñadora le quedaba
-- la fecha vieja. Ahora, al cambiar publications.fecha_publicacion, se recalcula
-- la fecha_limite de la tarea con el mismo criterio que la autogeneración:
-- fecha de publicación − 2 días (o null si la pieza queda sin fecha).
create or replace function public.jd_sync_pub_date_to_task() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.task_id is null then
    return new;
  end if;
  if new.fecha_publicacion is not distinct from old.fecha_publicacion then
    return new;
  end if;
  update public.tasks
    set fecha_limite = case
      when new.fecha_publicacion is not null
        then (new.fecha_publicacion at time zone 'America/Argentina/Cordoba')::date - 2
      else null
    end
  where id = new.task_id;
  return new;
end;
$$;

revoke execute on function public.jd_sync_pub_date_to_task() from anon, authenticated, public;

drop trigger if exists trg_pub_sync_date_to_task on public.publications;
create trigger trg_pub_sync_date_to_task
  after update of fecha_publicacion on public.publications
  for each row execute function public.jd_sync_pub_date_to_task();

-- Backfill: alinear la fecha límite de las tareas ACTIVAS vinculadas con la
-- fecha de su pieza (corrige las que quedaron desfasadas por mover el posteo).
update public.tasks t
set fecha_limite = (p.fecha_publicacion at time zone 'America/Argentina/Cordoba')::date - 2
from public.publications p
where p.task_id = t.id
  and p.fecha_publicacion is not null
  and t.estado not in ('completada', 'archivada')
  and t.fecha_limite is distinct from
      (p.fecha_publicacion at time zone 'America/Argentina/Cordoba')::date - 2;
