-- La tarea de diseño / edición nace cuando el director creativo aprueba la idea.
--
-- Pedido de Luz y Santi (2/10/2026): diseño y edición tienen que ver el
-- calendario recién cuando Santi lo aprobó. Hasta ahora el trigger creaba la
-- tarea en el momento de cargar la idea, así que a diseño le llegaban tareas
-- de ideas que todavía se podían cambiar o descartar. Ese día había 169 tareas
-- así, todas vacías (sin comentarios, horas, subtareas ni links).
--
-- Ahora:
-- * Al cargar una pieza en "idea" no se crea tarea.
-- * Cuando sale de "idea" (se aprueba, o se la mueve a mano a otra etapa) y no
--   tiene tarea, se crea en ese momento, con la misma lógica de siempre.
-- * Una pieza que se carga directamente en otra etapa crea la tarea como antes.

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

  -- Una idea sin aprobar no es trabajo de nadie todavía.
  if new.estado = 'idea' then
    return new;
  end if;

  -- En un UPDATE, solo al salir de "idea".
  if tg_op = 'UPDATE' and old.estado is distinct from 'idea' then
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

  if v_asignado is null then
    select id into v_asignado from public.users
      where activo = true
        and (area = 'Coordinación' or area_secundaria = 'Coordinación')
      order by created_at asc, nombre asc
      limit 1;
  end if;
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

drop trigger if exists trg_publications_autogen_task on public.publications;
create trigger trg_publications_autogen_task
  before insert or update of estado on public.publications
  for each row execute function public.jd_publication_autogen_task();

-- Las tareas que ya existían para ideas sin aprobar: se borran solo las que
-- nadie tocó (pendientes, sin comentarios, horas, subtareas, pedidos de cambio
-- ni links). Se vuelven a crear solas cuando se apruebe la idea.
delete from public.tasks t
using public.publications p
where p.task_id = t.id
  and p.estado = 'idea'
  and t.estado = 'pendiente'
  and coalesce(jsonb_array_length(t.links), 0) = 0
  and not exists (select 1 from public.comments c where c.task_id = t.id)
  and not exists (select 1 from public.task_time_entries x where x.task_id = t.id)
  and not exists (select 1 from public.tasks s where s.parent_id = t.id)
  and not exists (select 1 from public.task_change_requests x where x.task_id = t.id);
