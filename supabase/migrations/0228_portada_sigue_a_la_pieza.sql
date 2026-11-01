-- La tarea de portada quedaba abierta y vencida aunque la pieza ya estuviera
-- aprobada o publicada (1/11/2026). Ahora se cierra con la pieza.
create or replace function public.jd_cierra_portada_con_pieza()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.portada_task_id is null or new.estado is not distinct from old.estado then
    return new;
  end if;
  if new.estado::text in ('aprobado', 'revision_cliente', 'publicado') then
    update public.tasks
      set estado = 'completada', fecha_completada = coalesce(fecha_completada, now())
      where id = new.portada_task_id
        and estado not in ('completada', 'archivada');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jd_cierra_portada_con_pieza on public.publications;
create trigger trg_jd_cierra_portada_con_pieza
  after update of estado on public.publications
  for each row execute function public.jd_cierra_portada_con_pieza();
