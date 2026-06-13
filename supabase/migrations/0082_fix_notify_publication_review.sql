-- Fix: cambiar una publicación a "aprobado"/"rechazado" tiraba
--   column "tipo" is of type notification_type but expression is of type text
-- El trigger notify_publication_review inserta una notificación al cambiar de
-- estado; la versión viva quedó con un cast de tipo mal. Redefinimos la función
-- con cast explícito a notification_type y, sobre todo, envolvemos los INSERT de
-- notificación en un bloque EXCEPTION para que un problema con la notificación
-- NUNCA rompa el cambio de estado de la publicación.

create or replace function public.notify_publication_review() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_coord_id uuid;
  v_title text;
  v_me uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;

  v_title := coalesce(new.titulo, 'sin título');

  -- Notificaciones best-effort: si algo falla, no rompemos el cambio de estado.
  begin
    if new.estado = 'edicion' and new.audiovisual_id is not null
       and new.audiovisual_id <> v_me then
      insert into public.notifications(user_id, task_id, tipo, mensaje)
      values (new.audiovisual_id, new.task_id, 'asignacion'::notification_type,
              'Te asignaron edición: ' || v_title);
    end if;

    if new.estado = 'revision_creativa' then
      for v_coord_id in
        select id from public.users
        where rol = 'coordinador' and activo = true and id <> v_me
      loop
        insert into public.notifications(user_id, task_id, tipo, mensaje)
        values (v_coord_id, new.task_id, 'asignacion'::notification_type,
                'Revisión creativa: ' || v_title);
      end loop;
    end if;

    if new.estado in ('aprobado','rechazado') and new.creado_por_id is not null
       and new.creado_por_id <> v_me then
      insert into public.notifications(user_id, task_id, tipo, mensaje)
      values (new.creado_por_id, new.task_id, 'asignacion'::notification_type,
              (case when new.estado='aprobado' then 'Aprobada: ' else 'Cambios pedidos: ' end) || v_title);
    end if;
  exception when others then
    null;
  end;

  return new;
end;
$$;

revoke execute on function public.notify_publication_review() from anon, authenticated, public;
