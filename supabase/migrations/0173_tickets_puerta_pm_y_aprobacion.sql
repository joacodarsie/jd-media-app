-- El sistema de tickets, con las dos reglas del dueño del 15/9/2026.
--
-- 1) NADA DE DISEÑO LLEGA AL CLIENTE SIN LA DIRECTORA CREATIVA. Cuando una
--    tarea de diseño o edición pasa a "En revisión", queda con la directora
--    como aprobadora, le llega el aviso y empieza a correr su plazo de 24 horas
--    hábiles (`revision_desde`). Quien produce no puede darla por terminada:
--    si la marca "Completada", la base la deja en "En revisión".
--
--    Hasta hoy el campo aprobador existía pero no hacía nada: en toda la base
--    lo tenían 3 tareas, y el formulario prometía un aviso que no salía.
--
-- 2) UNA SOLA PUERTA: community, diseño y edición se le piden a la Project
--    Manager. Eso se resuelve en el código (lib/tareas/puerta.ts), que es por
--    donde se crean los tickets; acá no hace falta nada.
--
-- Las personas se resuelven por área, igual que el organigrama: la directora es
-- quien tenga `Coordinación de Diseño`.
--
-- Lo de antes de septiembre (fecha límite < 1/9) se cierra como siempre: son
-- tareas viejas que no van a ir a ningún cliente, y mandarlas a aprobar le
-- llenaría la bandeja a la directora de trabajo muerto.

alter table public.tasks add column if not exists revision_desde timestamptz;

comment on column public.tasks.revision_desde is
  'Cuándo entró a "en_revision". Desde acá corren las 24 horas hábiles de la aprobación. Null fuera de revisión.';

-- ─── Quién es la directora creativa ─────────────────────────────────────────

create or replace function public.jd_directora_creativa_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select id from public.users
  where activo = true
    and (area = 'Coordinación de Diseño' or area_secundaria = 'Coordinación de Diseño')
  order by created_at asc
  limit 1;
$$;

-- ─── Antes de guardar: la aprobación ────────────────────────────────────────

create or replace function public.jd_tasks_aprobacion()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := auth.uid();
  v_puede_aprobar boolean;
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  -- El candado: diseño y edición no se cierran sin pasar por la directora.
  --  - pg_trigger_depth() > 1: el cambio viene del calendario (la pieza se
  --    aprobó o se programó allá) y ahí manda el estado de la pieza.
  --  - v_actor null: procesos automáticos (crons, service role).
  if new.estado = 'completada'
     and new.area in ('Diseño', 'Edición Audiovisual')
     and coalesce(new.fecha_limite, current_date) >= date '2026-09-01'
     and pg_trigger_depth() <= 1
     and v_actor is not null then
    v_puede_aprobar :=
      v_actor = coalesce(new.aprobador_id, public.jd_directora_creativa_id())
      or v_actor = public.jd_directora_creativa_id()
      or public.jd_has_role(array['admin']);
    if not v_puede_aprobar then
      new.estado := 'en_revision';
      if old.estado = 'en_revision' then
        -- Ya estaba esperando: no se reinicia el reloj de la directora.
        return new;
      end if;
    end if;
  end if;

  if new.estado = 'en_revision' then
    new.revision_desde := now();
    if new.aprobador_id is null and new.area in ('Diseño', 'Edición Audiovisual') then
      new.aprobador_id := public.jd_directora_creativa_id();
    end if;
    new.requiere_aprobacion := new.aprobador_id is not null;
  else
    new.revision_desde := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tasks_aprobacion on public.tasks;
create trigger trg_tasks_aprobacion
  before update of estado on public.tasks
  for each row execute function public.jd_tasks_aprobacion();

-- ─── Después de guardar: el aviso a quien aprueba ───────────────────────────

create or replace function public.jd_tasks_aviso_aprobacion()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
begin
  if new.estado = 'en_revision'
     and old.estado is distinct from 'en_revision'
     and new.aprobador_id is not null
     and new.aprobador_id <> v_me then
    begin
      insert into public.notifications (user_id, task_id, tipo, mensaje, link)
      values (
        new.aprobador_id,
        new.id,
        'asignacion'::notification_type,
        'Para aprobar: ' || coalesce(new.titulo, 'una pieza') || ' · tenés 24 h hábiles',
        '/tareas/' || new.id::text
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_aviso_aprobacion on public.tasks;
create trigger trg_tasks_aviso_aprobacion
  after update of estado on public.tasks
  for each row execute function public.jd_tasks_aviso_aprobacion();

-- ─── Tarea → pieza del calendario ───────────────────────────────────────────
--
-- Antes: la tarea completada mandaba la pieza a "revisión creativa".
-- Ahora la tarea pasa por la directora ANTES de completarse, así que:
--  - tarea a "en revisión"            → pieza a "revisión creativa"
--  - tarea aprobada por la directora  → pieza a "revisión cliente" (lista para
--                                       mandarle al cliente)
--  - tarea cerrada por la dirección sin pasar por revisión → como antes.

create or replace function public.jd_sync_task_to_pub()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pub_id uuid;
  v_pub_estado text;
  v_new_pub_estado text;
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;

  select id, estado::text into v_pub_id, v_pub_estado
  from public.publications
  where task_id = new.id
  limit 1;

  if v_pub_id is null then
    return new;
  end if;

  if new.estado::text = 'en_revision'
     and v_pub_estado in ('idea', 'en_diseno', 'guion', 'edicion', 'rechazado') then
    v_new_pub_estado := 'revision_creativa';
  elsif new.estado::text = 'completada'
     and old.estado::text = 'en_revision'
     and new.aprobador_id is not null
     and v_pub_estado in ('idea', 'en_diseno', 'guion', 'edicion', 'revision_creativa') then
    v_new_pub_estado := 'revision_cliente';
  elsif new.estado::text = 'completada'
     and v_pub_estado in ('idea', 'en_diseno', 'guion', 'edicion') then
    v_new_pub_estado := 'revision_creativa';
  elsif new.estado::text in ('en_progreso', 'pendiente')
     and old.estado::text = 'en_revision'
     and v_pub_estado = 'revision_creativa' then
    -- La directora pidió cambios: la pieza vuelve a producción.
    v_new_pub_estado := case when new.area = 'Edición Audiovisual' then 'edicion' else 'en_diseno' end;
  else
    return new;
  end if;

  if v_pub_estado = v_new_pub_estado then
    return new;
  end if;

  update public.publications
    set estado = v_new_pub_estado::publication_status,
        revision_creativa_at = case
          when v_new_pub_estado = 'revision_creativa' then now()
          else revision_creativa_at
        end
  where id = v_pub_id;

  return new;
end;
$$;

-- ─── Pieza del calendario → tarea ───────────────────────────────────────────
--
-- "Revisión cliente" quiere decir que la directora ya la aprobó: para la tarea
-- de diseño eso es trabajo terminado, no "en revisión". Si la mandaba a
-- "en revisión", la aprobación desde el ticket rebotaba y la tarea volvía a
-- quedar esperando a la directora para siempre.

create or replace function public.jd_sync_pub_to_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
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
    when 'revision_cliente' then 'completada'
    when 'aprobado' then 'completada'
    when 'publicado' then 'completada'
    when 'rechazado' then 'en_progreso'
    else null
  end;

  if v_target is null then
    return new;
  end if;

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

-- ─── El aviso de "revisión creativa" de la pieza ────────────────────────────
--
-- Si la pieza tiene tarea, el aviso ya lo manda la tarea (con el link al
-- ticket, donde están los botones de aprobar). Sin esto le llegaban dos.

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

    -- Pasó a revisión creativa → SOLO a la Dirección Creativa, y solo si la
    -- pieza no tiene tarea (con tarea, avisa la tarea).
    if new.estado = 'revision_creativa' and new.task_id is null then
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

-- ─── Permisos: quien aprueba tiene que poder ver y mover la tarea ───────────
--
-- La directora no es "staff" y su área no es la de las tareas que aprueba, así
-- que hasta hoy no podía ni abrir el ticket que le tocaba aprobar.

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (
  jd_is_staff()
  or asignado_a_id = (select auth.uid())
  or creado_por_id = (select auth.uid())
  or aprobador_id = (select auth.uid())
  or area = jd_area()
  or cliente_id in (select clients.id from clients where clients.creativa_asignada_id = (select auth.uid()))
);

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update
using (
  jd_is_staff()
  or asignado_a_id = (select auth.uid())
  or creado_por_id = (select auth.uid())
  or aprobador_id = (select auth.uid())
  or area = jd_area()
  or cliente_id in (select clients.id from clients where clients.creativa_asignada_id = (select auth.uid()))
)
with check (
  jd_is_staff()
  or asignado_a_id = (select auth.uid())
  or creado_por_id = (select auth.uid())
  or aprobador_id = (select auth.uid())
  or area = jd_area()
  or cliente_id in (select clients.id from clients where clients.creativa_asignada_id = (select auth.uid()))
);

-- ─── Lo que ya estaba en revisión ───────────────────────────────────────────
-- Arranca con reloj (desde que entró, según el historial) y con aprobadora si
-- es de diseño o edición. No pasa por el trigger: no cambia el estado.

update public.tasks t
set revision_desde = coalesce(
      (select max(h.created_at) from public.task_history h
        where h.task_id = t.id and h.campo = 'estado' and h.valor_nuevo = 'en_revision'),
      t.updated_at),
    aprobador_id = coalesce(
      t.aprobador_id,
      case when t.area in ('Diseño', 'Edición Audiovisual') then public.jd_directora_creativa_id() end),
    requiere_aprobacion = coalesce(
      t.aprobador_id,
      case when t.area in ('Diseño', 'Edición Audiovisual') then public.jd_directora_creativa_id() end) is not null
where t.estado = 'en_revision';

-- ─── Para que el dueño lo pruebe ────────────────────────────────────────────

insert into public.review_flags (ruta, label, nota)
values (
  '/tareas',
  'Tickets: la puerta de Luz y la aprobación de Brisa',
  'Probar: 1) una CM crea un ticket de diseño eligiendo a Darío → tiene que quedar asignado a Luz. 2) Luz lo reasigna desde "Qué te toca". 3) Darío lo pasa a Completada → queda En revisión y le llega a Brisa. 4) Brisa aprueba o pide cambios desde el ticket, y ve el reloj de 24 h hábiles. 5) Arriba de /tareas: "Para repartir" (Luz) y "Para aprobar" (Brisa).'
);
