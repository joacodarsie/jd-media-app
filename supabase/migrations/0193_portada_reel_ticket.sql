-- Ticket de PORTADA para los reels.
--
-- Pedido de Brisa y Belén (10/10/2026): cuando la CM carga un reel, que también
-- le genere a diseño un ticket con la portada de ese reel y qué copy lleva
-- (ej: "FRAME DEL VIDEO NAHUEL CON TELA + 'ELEGÍ LA TELA DE TU SILLÓN'").
-- Hasta ahora el reel tenía "diseñador/a de la portada" (0104) solo para pagarla:
-- no le llegaba ningún ticket.
--
-- * `portada_copy`: qué lleva la portada. Si está vacío, no se crea ticket (no
--   todas las cuentas usan portada: la decide la CM).
-- * El ticket nace cuando el reel sale de "idea" (igual que el del editor) o al
--   completar el campo en un reel ya aprobado. Va al diseñador/a de la portada
--   del reel o, si no hay, al de la cuenta.
-- * Sigue la fecha del reel (2 días antes), se reasigna si cambia el
--   diseñador/a y se borra si se borra el reel (solo si nadie lo empezó).

alter table public.publications
  add column if not exists portada_copy text,
  add column if not exists portada_task_id uuid references public.tasks(id) on delete set null;

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
begin
  if new.tipo not in ('reel','video') then
    return new;
  end if;

  v_desc := 'Portada del reel «' || coalesce(new.titulo, 'sin título') || E'».\n\n'
            || coalesce(new.portada_copy, '')
            || case when new.referencia_url is not null
                    then E'\n\nReferencia: ' || new.referencia_url else '' end;

  -- Ya tiene ticket: si cambió lo que lleva, se actualiza mientras nadie lo empezó.
  if new.portada_task_id is not null then
    if tg_op = 'UPDATE' and new.portada_copy is distinct from old.portada_copy
       and nullif(btrim(coalesce(new.portada_copy, '')), '') is not null then
      update public.tasks set descripcion = v_desc
        where id = new.portada_task_id and estado = 'pendiente';
    end if;
    return new;
  end if;

  if nullif(btrim(coalesce(new.portada_copy, '')), '') is null then
    return new;
  end if;
  -- Una idea sin aprobar no es trabajo de nadie todavía; lo publicado ya pasó.
  if new.estado in ('idea', 'publicado') then
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
    v_desc,
    v_asignado,
    new.creado_por_id,
    new.cliente_id,
    'Diseño',
    'media',
    'pendiente',
    v_fl,
    '[]'::jsonb
  ) returning id into v_task_id;

  new.portada_task_id := v_task_id;
  return new;
end;
$function$;

drop trigger if exists trg_publications_portada_task on public.publications;
create trigger trg_publications_portada_task
  before insert or update of estado, portada_copy, tipo on public.publications
  for each row execute function public.jd_publication_portada_task();

-- Fecha y diseñador/a: el ticket de la portada sigue al reel.
create or replace function public.jd_sync_pub_portada_task()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.portada_task_id is null then
    return new;
  end if;
  if new.fecha_publicacion is distinct from old.fecha_publicacion
     and new.fecha_publicacion is not null then
    update public.tasks
      set fecha_limite = (new.fecha_publicacion at time zone 'America/Argentina/Cordoba')::date - 2
      where id = new.portada_task_id;
  end if;
  if new.disenador_id is distinct from old.disenador_id and new.disenador_id is not null then
    update public.tasks set asignado_a_id = new.disenador_id
      where id = new.portada_task_id and estado = 'pendiente';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_pub_sync_portada_task on public.publications;
create trigger trg_pub_sync_portada_task
  after update of fecha_publicacion, disenador_id on public.publications
  for each row execute function public.jd_sync_pub_portada_task();

-- Se borra el reel: se borra su ticket de portada si nadie lo empezó.
create or replace function public.jd_publication_delete_portada_task()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if old.portada_task_id is not null then
    delete from public.tasks where id = old.portada_task_id and estado = 'pendiente';
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_publications_delete_portada_task on public.publications;
create trigger trg_publications_delete_portada_task
  after delete on public.publications
  for each row execute function public.jd_publication_delete_portada_task();
