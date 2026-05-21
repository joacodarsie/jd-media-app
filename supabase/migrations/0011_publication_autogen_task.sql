-- Sprint 1: al crear una publicación, generar la tarea inicial del flujo
-- y vincularla via publications.task_id. Asigna según tipo:
--   - reel/video → audiovisual_id (o coordinador), área "Edición Audiovisual"
--   - resto      → disenador_id  (o cm_id, o coordinador), área "Diseño"
-- Fecha límite = fecha_publicacion - 2 días (si hay fecha; sino, en 5 días).

create or replace function public.jd_publication_autogen_task() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_asignado uuid;
  v_area     text;
  v_titulo   text;
  v_cliente  text;
  v_fl       date;
  v_task_id  uuid;
  v_es_video boolean;
  v_disen    uuid;
  v_cm       uuid;
  v_av       uuid;
begin
  -- Si ya viene con task_id, no generamos otra
  if new.task_id is not null then
    return new;
  end if;

  v_es_video := new.tipo in ('reel','video');

  select c.disenador_id, c.cm_id, c.audiovisual_id, c.nombre
    into v_disen, v_cm, v_av, v_cliente
  from public.clients c where c.id = new.cliente_id;

  if v_es_video then
    v_asignado := coalesce(new.audiovisual_id, v_av);
    v_area     := 'Edición Audiovisual';
  else
    v_asignado := coalesce(v_disen, v_cm);
    v_area     := 'Diseño';
  end if;

  -- Fallback: si no hay asignado, dejamos a Coordinación
  if v_asignado is null then
    select id into v_asignado from public.users
      where rol = 'coordinador' and activo = true
      order by created_at asc limit 1;
  end if;

  v_titulo := (case when v_es_video then 'Editar' else 'Diseñar' end)
              || ' pieza: ' || coalesce(new.titulo, 'sin título')
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
$$;

revoke execute on function public.jd_publication_autogen_task() from anon, authenticated, public;

drop trigger if exists trg_publications_autogen_task on public.publications;
create trigger trg_publications_autogen_task
  before insert on public.publications
  for each row execute function public.jd_publication_autogen_task();
