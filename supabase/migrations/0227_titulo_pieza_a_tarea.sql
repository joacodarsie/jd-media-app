-- Cambiarle el título a una pieza no llegaba a sus tareas (31/10/2026). Carlos
-- buscaba en el calendario "Desde su POV" y la pieza se llamaba "Jugar es...":
-- creía estar al día y tenía una tarea vencida. Lo mismo que ya hacen la fecha y
-- el responsable: la tarea sigue a la pieza. Se conserva el prefijo y la cuenta.
create or replace function public.jd_titulo_tarea_de_pieza(actual text, titulo text)
returns text
language sql
immutable
as $$
  select coalesce(substring(actual from '^(?:Editar pieza|Diseñar pieza|Hacer historia|Portada): '), '')
    || titulo
    || coalesce(substring(actual from ' · [^·]+$'), '');
$$;

create or replace function public.jd_sync_pub_titulo_to_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.titulo is not distinct from old.titulo or coalesce(trim(new.titulo), '') = '' then
    return new;
  end if;
  update public.tasks
    set titulo = public.jd_titulo_tarea_de_pieza(titulo, new.titulo)
    where id in (new.task_id, new.portada_task_id)
      and titulo ~ '^(Editar pieza|Diseñar pieza|Hacer historia|Portada): ';
  return new;
end;
$$;

drop trigger if exists trg_jd_sync_pub_titulo_to_task on public.publications;
create trigger trg_jd_sync_pub_titulo_to_task
  after update of titulo on public.publications
  for each row execute function public.jd_sync_pub_titulo_to_task();

-- Las tareas abiertas que ya quedaron con el nombre viejo.
update public.tasks t
  set titulo = public.jd_titulo_tarea_de_pieza(t.titulo, p.titulo)
  from public.publications p
  where t.id in (p.task_id, p.portada_task_id)
    and t.estado not in ('completada', 'archivada')
    and coalesce(trim(p.titulo), '') <> ''
    and t.titulo ~ '^(Editar pieza|Diseñar pieza|Hacer historia|Portada): '
    and t.titulo <> public.jd_titulo_tarea_de_pieza(t.titulo, p.titulo);
