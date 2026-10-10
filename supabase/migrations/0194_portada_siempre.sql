-- Todo reel aprobado lleva ticket de portada (pedido del dueño, 10/10/2026).
--
-- En la 0193 el ticket nacía solo si la CM completaba "Portada (frame + copy)".
-- Ahora nace siempre que el reel sale de "idea"; si el campo está vacío, el
-- ticket lo dice, y cuando la CM lo completa se actualiza la descripción.
-- Además se crean los tickets de los reels ya aprobados con fecha por delante
-- (los de fecha pasada sin marcar como publicados se dejan: saldrían vencidos).

create or replace function public.jd_publication_portada_task()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_asignado uuid;
  v_cliente  text;
  v_disen    uuid;
  v_fl       date;
  v_task_id  uuid;
  v_desc     text;
  v_copy     text;
begin
  if new.tipo not in ('reel','video') then
    return new;
  end if;

  v_copy := nullif(btrim(coalesce(new.portada_copy, '')), '');
  v_desc := 'Portada del reel «' || coalesce(new.titulo, 'sin título') || E'».\n\n'
            || coalesce(v_copy, 'Frame y copy: todavía no los cargó la CM (pedíselos o elegí un frame del video con el título).')
            || case when new.referencia_url is not null
                    then E'\n\nReferencia: ' || new.referencia_url else '' end;

  if new.portada_task_id is not null then
    if tg_op = 'UPDATE' and new.portada_copy is distinct from old.portada_copy and v_copy is not null then
      update public.tasks set descripcion = v_desc
        where id = new.portada_task_id and estado = 'pendiente';
    end if;
    return new;
  end if;

  if new.estado in ('idea', 'publicado') then
    return new;
  end if;
  -- Solo al crearse o al salir de "idea": cambiar el copy u otro estado de un
  -- reel viejo no le inventa un ticket.
  if tg_op = 'UPDATE' and old.estado is distinct from 'idea' and v_copy is null then
    return new;
  end if;

  select c.disenador_id, c.nombre into v_disen, v_cliente
  from public.clients c where c.id = new.cliente_id;

  v_asignado := coalesce(new.disenador_id, v_disen);
  if v_asignado is null then
    select id into v_asignado from public.users
      where activo = true
        and (area = 'Coordinación' or area_secundaria = 'Coordinación')
      order by created_at asc, nombre asc
      limit 1;
  end if;

  v_fl := case
    when new.fecha_publicacion is not null
      then (new.fecha_publicacion at time zone 'America/Argentina/Cordoba')::date - 2
    else (now() at time zone 'America/Argentina/Cordoba')::date + 5
  end;

  insert into public.tasks(
    titulo, descripcion, asignado_a_id, creado_por_id,
    cliente_id, area, prioridad, estado, fecha_limite, links
  ) values (
    'Portada: ' || coalesce(new.titulo, 'sin título') || coalesce(' · ' || v_cliente, ''),
    v_desc, v_asignado, new.creado_por_id, new.cliente_id,
    'Diseño', 'media', 'pendiente', v_fl, '[]'::jsonb
  ) returning id into v_task_id;

  new.portada_task_id := v_task_id;
  return new;
end;
$function$;

-- Backfill: reels aprobados, sin publicar, con fecha de hoy en adelante.
do $$
declare r record; v_task uuid; v_disen uuid; v_cli text; v_asig uuid; v_copy text;
begin
  for r in
    select p.* from public.publications p
    where p.tipo in ('reel','video') and p.estado not in ('idea','publicado')
      and p.portada_task_id is null
      and p.fecha_publicacion >= date_trunc('day', now() at time zone 'America/Argentina/Cordoba') at time zone 'America/Argentina/Cordoba'
  loop
    select c.disenador_id, c.nombre into v_disen, v_cli from public.clients c where c.id = r.cliente_id;
    v_asig := coalesce(r.disenador_id, v_disen);
    if v_asig is null then
      select id into v_asig from public.users
        where activo = true and (area = 'Coordinación' or area_secundaria = 'Coordinación')
        order by created_at asc, nombre asc limit 1;
    end if;
    v_copy := nullif(btrim(coalesce(r.portada_copy, '')), '');
    insert into public.tasks(titulo, descripcion, asignado_a_id, creado_por_id, cliente_id, area, prioridad, estado, fecha_limite, links)
    values (
      'Portada: ' || coalesce(r.titulo, 'sin título') || coalesce(' · ' || v_cli, ''),
      'Portada del reel «' || coalesce(r.titulo, 'sin título') || E'».\n\n'
        || coalesce(v_copy, 'Frame y copy: todavía no los cargó la CM (pedíselos o elegí un frame del video con el título).')
        || case when r.referencia_url is not null then E'\n\nReferencia: ' || r.referencia_url else '' end,
      v_asig, r.creado_por_id, r.cliente_id, 'Diseño', 'media', 'pendiente',
      greatest((r.fecha_publicacion at time zone 'America/Argentina/Cordoba')::date - 2,
               (now() at time zone 'America/Argentina/Cordoba')::date),
      '[]'::jsonb
    ) returning id into v_task;
    update public.publications set portada_task_id = v_task where id = r.id;
  end loop;
end $$;
