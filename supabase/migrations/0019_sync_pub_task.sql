-- C12: sincronización bidireccional entre estado de publicación y estado de su tarea vinculada.
-- Una publicación tiene `task_id` (la tarea que generó cuando se creó la pub).
-- La idea es:
--   - Cuando avanzás la pub, la tarea refleja en qué punto está el trabajo.
--   - Cuando se completa la tarea, la pub avanza al siguiente paso (revision_creativa).
-- Mapeo pub → task:
--   idea                                   → pendiente
--   en_diseno / guion / edicion           → en_progreso
--   revision_creativa / revision_cliente  → en_revision
--   aprobado / publicado                  → completada
--   rechazado                             → en_progreso (vuelve a trabajar)

create or replace function public.jd_sync_pub_to_task() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_target text;
  v_current text;
begin
  if new.task_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;

  v_target := case new.estado::text
    when 'idea' then 'pendiente'
    when 'en_diseno' then 'en_progreso'
    when 'guion' then 'en_progreso'
    when 'edicion' then 'en_progreso'
    when 'revision_creativa' then 'en_revision'
    when 'revision_cliente' then 'en_revision'
    when 'aprobado' then 'completada'
    when 'publicado' then 'completada'
    when 'rechazado' then 'en_progreso'
    else null
  end;

  if v_target is null then
    return new;
  end if;

  -- Evitar updates innecesarios (corta el loop con el otro trigger).
  select estado::text into v_current from public.tasks where id = new.task_id;
  if v_current is null or v_current = v_target then
    return new;
  end if;

  update public.tasks
    set estado = v_target::task_status,
        fecha_completada = case
          when v_target = 'completada' and fecha_completada is null then now()
          when v_target <> 'completada' then null
          else fecha_completada
        end
    where id = new.task_id;

  return new;
end;
$$;

revoke execute on function public.jd_sync_pub_to_task() from anon, authenticated, public;

drop trigger if exists trg_pub_sync_to_task on public.publications;
create trigger trg_pub_sync_to_task
  after update of estado on public.publications
  for each row execute function public.jd_sync_pub_to_task();

-- ===========================================
-- task → publication
-- Sólo: cuando la tarea se completa, la pub avanza a revision_creativa
-- (si estaba en producción). El resto del flujo de la pub queda al equipo.
-- ===========================================
create or replace function public.jd_sync_task_to_pub() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_pub_id uuid;
  v_pub_estado text;
  v_new_pub_estado text;
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;

  -- Buscar publicación que use esta tarea como task_id
  select id, estado::text into v_pub_id, v_pub_estado
  from public.publications
  where task_id = new.id
  limit 1;

  if v_pub_id is null then
    return new;
  end if;

  -- Reglas mínimas (no rompen flujos del usuario):
  if new.estado::text = 'completada'
     and v_pub_estado in ('idea','en_diseno','guion','edicion') then
    v_new_pub_estado := 'revision_creativa';
  elsif new.estado::text in ('en_progreso','pendiente')
     and v_pub_estado in ('aprobado','publicado') then
    -- volvió a trabajar una pub ya cerrada → no la "bajamos"; ignoramos.
    return new;
  else
    return new;
  end if;

  if v_pub_estado = v_new_pub_estado then
    return new;
  end if;

  update public.publications
    set estado = v_new_pub_estado::publication_status
  where id = v_pub_id;

  return new;
end;
$$;

revoke execute on function public.jd_sync_task_to_pub() from anon, authenticated, public;

drop trigger if exists trg_task_sync_to_pub on public.tasks;
create trigger trg_task_sync_to_pub
  after update of estado on public.tasks
  for each row execute function public.jd_sync_task_to_pub();
