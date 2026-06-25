-- Fix: al borrar una publicación, su tarea autogenerada (publications.task_id)
-- quedaba colgada (huérfana) — una tarea "Diseñar/Editar/Hacer pieza" pendiente
-- sin nada en el calendario, que confunde a quien la tiene asignada.
--
-- Ahora, al borrar la publicación, se borra también su tarea vinculada. (La FK
-- era on delete set null, así que sin esto la tarea sobrevivía sin pieza.)
create or replace function public.jd_publication_delete_task() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.task_id is not null then
    delete from public.tasks where id = old.task_id;
  end if;
  return old;
end;
$$;

revoke execute on function public.jd_publication_delete_task() from anon, authenticated, public;

drop trigger if exists trg_publications_delete_task on public.publications;
create trigger trg_publications_delete_task
  before delete on public.publications
  for each row execute function public.jd_publication_delete_task();
