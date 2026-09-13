-- El Jira de JD Media, primera pieza: número de ticket y jerarquía madre/subtarea.
--
-- De la reunión del equipo del 13/9/2026. El dueño lo describió así: un ticket
-- madre ("los 15 días de contenido", "Destacadas") con subtareas adentro que
-- son el desglose —una por publicación, o "portadas" y "placas" dentro de
-- Destacadas—, y un número visible para poder referirse al ticket y para
-- nombrar la carpeta de Drive.
--
-- Lo que YA existía y no hace falta crear: responsable, fecha límite, estado,
-- prioridad, cliente (el "proyecto") y comentarios (tabla `comments`).

-- ── Número de ticket ─────────────────────────────────────────────────────────
--
-- Correlativo global, no por cliente. Un número único en toda la agencia se
-- puede nombrar en una conversación sin aclarar de qué cuenta es, y sirve tal
-- cual para la carpeta de Drive. El cliente ya se ve en el ticket.
create sequence if not exists public.tasks_numero_seq;

alter table public.tasks add column if not exists numero integer;

-- Backfill en orden de creación: las tareas viejas también tienen que poder
-- nombrarse. Solo corre la primera vez (las que ya tienen número no se tocan).
do $$
declare
  r record;
begin
  for r in select id from public.tasks where numero is null order by created_at, id loop
    update public.tasks set numero = nextval('public.tasks_numero_seq') where id = r.id;
  end loop;
end $$;

-- Recién ahora el default y la unicidad: si se pusieran antes, el backfill
-- competiría con la secuencia.
alter table public.tasks
  alter column numero set default nextval('public.tasks_numero_seq');

create unique index if not exists tasks_numero_key on public.tasks(numero);

-- ── Jerarquía ────────────────────────────────────────────────────────────────
--
-- `parent_id` null = ticket madre. Con valor = subtarea de ese ticket.
-- On delete cascade: borrar el ticket madre se lleva su desglose, que es lo que
-- alguien espera al borrar "los 15 días de contenido".
alter table public.tasks
  add column if not exists parent_id uuid references public.tasks(id) on delete cascade;

create index if not exists idx_tasks_parent on public.tasks(parent_id);

-- UN SOLO NIVEL. Sin esto se arman cadenas de subtareas de subtareas y ninguna
-- pantalla las puede mostrar bien. Se valida en la base y no solo en la app
-- porque las tareas se crean desde varios lugares.
create or replace function public.tasks_un_solo_nivel()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Una tarea no puede ser subtarea de sí misma';
    end if;
    if exists (select 1 from public.tasks t where t.id = new.parent_id and t.parent_id is not null) then
      raise exception 'Solo se permite un nivel de subtareas: el ticket madre no puede ser a su vez una subtarea';
    end if;
  end if;
  -- Si esta tarea YA tiene hijas, no puede pasar a ser subtarea de otra.
  if new.parent_id is not null
     and exists (select 1 from public.tasks t where t.parent_id = new.id) then
    raise exception 'Esta tarea tiene subtareas: no puede convertirse en subtarea';
  end if;
  return new;
end $$;

drop trigger if exists trg_tasks_un_solo_nivel on public.tasks;
create trigger trg_tasks_un_solo_nivel
  before insert or update of parent_id on public.tasks
  for each row execute function public.tasks_un_solo_nivel();

insert into public.review_flags (ruta, label, nota)
values (
  '/tareas',
  'Tickets: número y subtareas',
  'Cada tarea tiene ahora un número visible (JD-123) y puede tener subtareas adentro, como un ticket de Jira. Revisar: (1) que el número aparezca en la lista y en la tarea, (2) que desde una tarea se puedan agregar subtareas y se vean agrupadas, (3) que el avance del ticket madre refleje las subtareas terminadas, (4) que no deje anidar una subtarea dentro de otra.'
)
on conflict do nothing;
