-- Que cada aviso llegue una sola vez y solo a quien le compete.
--
-- Dos problemas medidos el 13/9/2026 contra la base de producción:
--
-- 1) ASIGNAR UNA TAREA MANDABA DOS AVISOS IDÉNTICOS. Hay más de un trigger de
--    notificación vivo sobre `tasks`, y al menos uno no está en ninguna
--    migración: dice "Te reasignaron la tarea", texto que no existe en el
--    repositorio. O sea que la base se editó a mano en algún momento y quedó
--    desincronizada. Por eso acá NO se dropea por nombre —no los conocemos
--    todos— sino recorriendo el catálogo.
--
-- 2) EL AVISO DE "REVISIÓN CREATIVA" LE LLEGABA A QUIEN NO LE IMPORTA Y NO LE
--    LLEGABA A QUIEN SÍ. Notificaba a TODO `rol = 'coordinador'`, que hoy son
--    Luz (operaciones), Guillermo (Paid Media) y Santiago (Comercial).
--    Resultado real acumulado: Guillermo 74 avisos, Santiago 3 — ninguno de los
--    dos revisa diseños. Y Brisa, que es la Dirección Creativa y la única que
--    aprueba, tiene rol `coordinador_diseno` y recibió CERO.
--
-- Es exactamente el mecanismo por el que la gente deja de mirar la campanita:
-- si la mayoría de lo que te llega no es tuyo, dejás de abrirla, y el día que
-- llega el aviso que sí importaba tampoco lo ves.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Un solo trigger de asignación sobre `tasks`
-- ─────────────────────────────────────────────────────────────────────────────

-- Barremos TODOS los triggers de tasks cuya función escriba en `notifications`,
-- se llamen como se llamen. Es la única forma de limpiar lo que no está en las
-- migraciones.
do $$
declare
  r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.tasks'::regclass
      and not t.tgisinternal
      and pg_get_functiondef(p.oid) ilike '%notifications%'
  loop
    execute format('drop trigger if exists %I on public.tasks', r.tgname);
  end loop;
end $$;

create or replace function public.notify_task_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
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
end $$;

revoke execute on function public.notify_task_assignment() from anon, authenticated, public;

drop trigger if exists trg_task_assignment on public.tasks;
create trigger trg_task_assignment
  after insert or update of asignado_a_id on public.tasks
  for each row execute function public.notify_task_assignment();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Revisión creativa: al que aprueba, no a todos los coordinadores
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_publication_review() returns trigger
language plpgsql security definer
set search_path = public
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

    -- Pasó a revisión creativa → SOLO a la Dirección Creativa, que es quien
    -- aprueba. Antes iba a todo rol 'coordinador': Paid Media y Comercial
    -- recibieron 77 avisos entre los dos, y quien aprueba recibió cero.
    if new.estado = 'revision_creativa' then
      for v_dest in
        select id from public.users
        where activo = true
          and id <> v_me
          and (rol = 'coordinador_diseno' or rol_secundario = 'coordinador_diseno')
      loop
        insert into public.notifications(user_id, task_id, tipo, mensaje, link)
        values (v_dest, new.task_id, 'asignacion'::notification_type,
                'Esperando tu aprobación: ' || v_title, '/contenidos');
      end loop;
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

revoke execute on function public.notify_publication_review() from anon, authenticated, public;

insert into public.review_flags (ruta, label, nota)
values (
  '/notificaciones',
  'Los avisos llegan una vez y a quien le toca',
  'Se limpiaron los avisos duplicados al asignar una tarea (había más de un trigger vivo, uno de ellos fuera de las migraciones) y se corrigió a quién le llega el de revisión creativa: antes iba a Paid Media y a Comercial —74 y 3 avisos— y NO le llegaba a Brisa, que es quien aprueba. Revisar: (1) que al asignar una tarea llegue UN solo aviso y con la fecha, (2) que al mandar una pieza a revisión creativa le llegue a Brisa y a nadie más, (3) que tocando el aviso se abra la tarea o el calendario.'
)
on conflict do nothing;
