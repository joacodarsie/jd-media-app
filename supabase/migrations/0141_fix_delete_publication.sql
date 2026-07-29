-- FIX: no se podía BORRAR nada del calendario de contenido.
--
-- Síntoma (lo reportó Luz): "la plataforma no está dejando eliminar cosas de los
-- calendarios". Afectaba a toda pieza con tarea vinculada: 348 de 374.
--
-- Causa: el trigger de la 0108 (`trg_publications_delete_task`) era BEFORE DELETE
-- y borraba la tarea de `publications.task_id`. Esa FK es `on delete set null`,
-- así que borrar la tarea UPDATEA la misma fila de publications que se está
-- borrando en ese mismo comando, y Postgres aborta:
--
--   27000: tuple to be deleted was already modified by an operation triggered by
--          the current command
--   HINT:  Consider using an AFTER trigger instead of a BEFORE trigger.
--
-- Arreglo: el trigger pasa a AFTER DELETE. Ahí la publicación ya no existe, así
-- que borrar la tarea no toca ninguna fila en juego. La intención de la 0108 se
-- mantiene: la tarea autogenerada no queda huérfana.

create or replace function public.jd_publication_delete_task() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.task_id is not null then
    delete from public.tasks where id = old.task_id;
  end if;
  return null; -- AFTER trigger: el valor de retorno se ignora
end;
$$;

revoke execute on function public.jd_publication_delete_task() from anon, authenticated, public;

drop trigger if exists trg_publications_delete_task on public.publications;
create trigger trg_publications_delete_task
  after delete on public.publications
  for each row execute function public.jd_publication_delete_task();

-- Que el dueño lo revise con sus ojos.
insert into public.review_flags (ruta, label, nota)
values (
  '/contenidos',
  'Borrar publicaciones del calendario',
  'Estaba roto: no se podía eliminar ninguna pieza que tuviera tarea vinculada (348 de 374). Probar: borrar una pieza desde el detalle en /contenidos y desde el calendario de un cliente, y borrar varias juntas con "Seleccionar" en la vista Tabla. Verificar también que la tarea vinculada desaparezca de /tareas.'
);
