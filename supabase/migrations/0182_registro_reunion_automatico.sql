-- La reunión mensual se registra sola (19/9/2026).
--
-- El ticket de la reunión ya se crea solo todos los meses, pero registrar que
-- la reunión SE DIO seguía siendo un paso a mano en la ficha del cliente — y es
-- justo el paso que nadie hace: en septiembre de 2026 había 16 tickets abiertos
-- y 2 reuniones registradas. Para la agencia, 14 reuniones que quizá se dieron
-- no existieron: no cuentan para la retención ni para el 5% de cartera, que se
-- cobra por darlas.
--
-- Se cierra el círculo en las dos direcciones:
--   1. Completás el ticket  → queda registrada la reunión del período.
--   2. Registrás la reunión → se completa el ticket.
--
-- Las dos son idempotentes y se cortan entre sí: el paso 1 no vuelve a insertar
-- si ya hay reunión, y el paso 2 no toca un ticket ya completado. Así no se
-- llaman en loop.

-- 1) Ticket completado → reunión registrada.
create or replace function public.jd_task_to_meeting()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_periodo text;
begin
  if new.estado::text <> 'completada' or old.estado::text = 'completada' then
    return new;
  end if;
  if new.cliente_id is null or new.titulo not like 'Reunión mensual — %' then
    return new;
  end if;

  -- El título termina en " — YYYY-MM": de ahí sale el período.
  v_periodo := right(new.titulo, 7);
  if v_periodo !~ '^\d{4}-\d{2}$' then
    return new;
  end if;

  insert into public.client_meetings (cliente_id, periodo, fecha, notas, registrado_por)
  select
    new.cliente_id,
    v_periodo,
    (now() at time zone 'America/Argentina/Cordoba')::date,
    'Registrada automáticamente al completar el ticket de la reunión.',
    new.asignado_a_id
  where not exists (
    select 1 from public.client_meetings m
    where m.cliente_id = new.cliente_id and m.periodo = v_periodo
  );

  return new;
end;
$$;

drop trigger if exists trg_task_to_meeting on public.tasks;
create trigger trg_task_to_meeting
  after update on public.tasks
  for each row execute function public.jd_task_to_meeting();

-- 2) Reunión registrada → ticket completado.
create or replace function public.jd_meeting_to_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.tasks
     set estado = 'completada',
         fecha_completada = coalesce(fecha_completada, now())
   where cliente_id = new.cliente_id
     and titulo like 'Reunión mensual — %— ' || new.periodo
     and estado::text not in ('completada', 'archivada');
  return new;
end;
$$;

drop trigger if exists trg_meeting_to_task on public.client_meetings;
create trigger trg_meeting_to_task
  after insert on public.client_meetings
  for each row execute function public.jd_meeting_to_task();
