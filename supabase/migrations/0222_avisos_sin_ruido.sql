-- Menos ruido en la campanita (24/10/2026). En la última semana Luz recibió 101
-- avisos y leyó 0, Santi 64 y leyó el 3%: la mayoría eran «Te asignaron» de
-- tareas que crea el sistema solo (rutinas, arranque, onboarding), que igual
-- aparecen en Mi día y en Tareas. Esas ya no avisan; las que asigna una persona, sí.
create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_fecha text;
begin
  -- Nada que avisar si no hay responsable o si no cambió.
  if new.asignado_a_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.asignado_a_id is not distinct from old.asignado_a_id then
    return new;
  end if;
  -- A quien hizo el cambio no se le avisa: acaba de hacerlo.
  if new.asignado_a_id = v_me then return new; end if;
  -- Las que crea el sistema solo no avisan: ya están en Mi día y en Tareas.
  if tg_op = 'INSERT' and (new.rutina_key is not null or (auth.uid() is null and new.parent_id is not null)) then
    return new;
  end if;

  -- La fecha va EN el aviso: "te asignaron algo" sin cuándo obliga a entrar
  -- para saber si es para hoy o para dentro de dos semanas.
  v_fecha := case
    when new.fecha_limite is null then 'sin fecha'
    else to_char(new.fecha_limite, 'DD/MM')
  end;

  -- Best-effort: un problema con la notificación no puede voltear el guardado
  -- de la tarea, que es lo que de verdad importa.
  begin
    insert into public.notifications (user_id, task_id, tipo, mensaje, link)
    values (
      new.asignado_a_id,
      new.id,
      'asignacion'::notification_type,
      'Te asignaron: ' || coalesce(new.titulo, 'una tarea') || ' · entrega ' || v_fecha,
      '/tareas/' || new.id::text
    );
  exception when others then
    null;
  end;

  return new;
end $function$;
