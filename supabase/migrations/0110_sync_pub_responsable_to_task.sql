-- Fix: la tarea autogenerada se asigna al responsable de la pieza al CREARLA,
-- pero si después se cambia el responsable (publications.audiovisual_id) —por
-- ejemplo al pasar la cuenta de una diseñadora a otra— la tarea seguía asignada
-- a la persona vieja. Quedaba la pieza con una persona y la tarea con otra.
--
-- Ahora, al cambiar el responsable de la pieza, la tarea vinculada se reasigna a
-- esa persona automáticamente.
create or replace function public.jd_sync_pub_responsable_to_task() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.task_id is null or new.audiovisual_id is null then
    return new;
  end if;
  if new.audiovisual_id is not distinct from old.audiovisual_id then
    return new;
  end if;
  update public.tasks
    set asignado_a_id = new.audiovisual_id
  where id = new.task_id;
  return new;
end;
$$;

revoke execute on function public.jd_sync_pub_responsable_to_task() from anon, authenticated, public;

drop trigger if exists trg_pub_sync_responsable_to_task on public.publications;
create trigger trg_pub_sync_responsable_to_task
  after update of audiovisual_id on public.publications
  for each row execute function public.jd_sync_pub_responsable_to_task();

-- Backfill (red de seguridad): alinear el asignado de las tareas ACTIVAS con el
-- responsable de su pieza, donde difieran.
update public.tasks t
set asignado_a_id = p.audiovisual_id
from public.publications p
where p.task_id = t.id
  and p.audiovisual_id is not null
  and t.estado not in ('completada', 'archivada')
  and t.asignado_a_id is distinct from p.audiovisual_id;
