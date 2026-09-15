-- Las tareas que nacen solas del calendario, cuando la cuenta no tiene a nadie
-- cargado para ese trabajo, le llegan a la Project Manager.
--
-- Antes caían en "el primer coordinador por fecha de alta". Luz Torres y
-- Guillermo García tienen EXACTAMENTE la misma fecha de alta (se importaron
-- juntos el 20/5), así que la pieza le podía tocar a Paid Media. Con la regla
-- del 15/9 (community, diseño y edición los reparte la PM), la que corresponde
-- es ella, resuelta por área como en el resto de la app.
--
-- Las tareas de cuentas con diseñador/editor/CM cargado siguen yendo directo a
-- esa persona: ese reparto ya lo decidió la PM al armar el equipo de la cuenta.

create or replace function public.jd_publication_autogen_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_asignado uuid;
  v_area     text;
  v_titulo   text;
  v_cliente  text;
  v_fl       date;
  v_task_id  uuid;
  v_disen    uuid;
  v_cm       uuid;
  v_av       uuid;
  v_verbo    text;
begin
  if new.task_id is not null then
    return new;
  end if;

  select c.disenador_id, c.cm_id, c.audiovisual_id, c.nombre
    into v_disen, v_cm, v_av, v_cliente
  from public.clients c where c.id = new.cliente_id;

  if new.tipo in ('reel','video') then
    v_asignado := coalesce(new.audiovisual_id, v_av);
    v_area     := 'Edición Audiovisual';
    v_verbo    := 'Editar';
  elsif new.tipo = 'historia' then
    v_asignado := coalesce(new.audiovisual_id, v_cm);
    v_area     := 'Community Manager';
    v_verbo    := 'Hacer historia';
  else
    v_asignado := coalesce(new.audiovisual_id, v_disen, v_cm);
    v_area     := 'Diseño';
    v_verbo    := 'Diseñar';
  end if;

  -- Sin nadie cargado en la cuenta: a la Project Manager, que reparte.
  if v_asignado is null then
    select id into v_asignado from public.users
      where activo = true
        and (area = 'Coordinación' or area_secundaria = 'Coordinación')
      order by created_at asc, nombre asc
      limit 1;
  end if;
  -- Y si no hubiera PM cargada, a cualquier coordinador (orden estable).
  if v_asignado is null then
    select id into v_asignado from public.users
      where rol = 'coordinador' and activo = true
      order by created_at asc, nombre asc
      limit 1;
  end if;

  v_titulo := v_verbo
              || (case when new.tipo = 'historia' then ': ' else ' pieza: ' end)
              || coalesce(new.titulo, 'sin título')
              || coalesce(' · ' || v_cliente, '');

  v_fl := case
    when new.fecha_publicacion is not null
      then (new.fecha_publicacion at time zone 'America/Argentina/Cordoba')::date - 2
    else (now() at time zone 'America/Argentina/Cordoba')::date + 5
  end;

  insert into public.tasks(
    titulo, descripcion, asignado_a_id, creado_por_id,
    cliente_id, area, prioridad, estado, fecha_limite, links
  ) values (
    v_titulo,
    coalesce(new.descripcion, '') ||
      case when new.referencia_url is not null
           then E'\n\nReferencia: ' || new.referencia_url else '' end,
    v_asignado,
    new.creado_por_id,
    new.cliente_id,
    v_area,
    'media',
    'pendiente',
    v_fl,
    '[]'::jsonb
  ) returning id into v_task_id;

  new.task_id := v_task_id;
  return new;
end;
$function$;
