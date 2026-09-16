-- Quién aprueba el diseño se resuelve por ÁREA, no por rol.
--
-- El 16/9/2026 la Directora Creativa renunció al puesto (sigue como diseñadora
-- de una cuenta). La aprobación pasó a la Project Manager dándole el área
-- "Coordinación de Diseño" como secundaria, SIN darle el rol: el rol
-- `coordinador_diseno` es el que dispara el 5% de dirección creativa en la
-- nómina, y ese pago no corresponde.
--
-- El aviso de la pieza del calendario todavía buscaba por rol, así que se
-- quedaba sin destinatario. Ahora usa la misma función que el resto de la app.

create or replace function public.notify_publication_review()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_dest uuid;
  v_title text;
  v_me uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;

  v_title := coalesce(new.titulo, 'sin título');

  begin
    -- Pasó a edición → al editor de la pieza.
    if new.estado = 'edicion' and new.audiovisual_id is not null
       and new.audiovisual_id <> v_me then
      insert into public.notifications(user_id, task_id, tipo, mensaje, link)
      values (new.audiovisual_id, new.task_id, 'asignacion'::notification_type,
              'Te asignaron edición: ' || v_title, '/contenidos');
    end if;

    -- Pasó a revisión creativa → a quien aprueba hoy (por área), y solo si la
    -- pieza no tiene tarea (con tarea, el aviso lo manda la tarea).
    if new.estado = 'revision_creativa' and new.task_id is null then
      v_dest := public.jd_directora_creativa_id();
      if v_dest is not null and v_dest <> v_me then
        insert into public.notifications(user_id, task_id, tipo, mensaje, link)
        values (v_dest, new.task_id, 'asignacion'::notification_type,
                'Esperando tu aprobación: ' || v_title, '/contenidos');
      end if;
    end if;

    -- Se aprobó o se pidieron cambios → a quien la creó, que es quien sigue.
    if new.estado in ('aprobado','rechazado') and new.creado_por_id is not null
       and new.creado_por_id <> v_me then
      insert into public.notifications(user_id, task_id, tipo, mensaje, link)
      values (new.creado_por_id, new.task_id, 'asignacion'::notification_type,
              (case when new.estado='aprobado' then 'Aprobada: ' else 'Cambios pedidos: ' end)
                || v_title,
              '/contenidos');
    end if;
  exception when others then
    null;
  end;

  return new;
end;
$$;
