-- Sprint 1: auditoría de cambios en tareas
create table if not exists public.task_history (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  campo       text not null,           -- 'estado' | 'asignado_a_id' | 'fecha_limite' | 'prioridad' | 'creada'
  valor_anterior text,
  valor_nuevo    text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_task_history_task on public.task_history(task_id, created_at desc);

alter table public.task_history enable row level security;

-- Las mismas personas que pueden ver la tarea pueden ver su historial.
drop policy if exists task_history_select on public.task_history;
create policy task_history_select on public.task_history
  for select to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = task_history.task_id
        -- se delega el filtro al RLS de tasks: si puede leer la tarea, puede leer el historial
    )
  );

-- Solo el sistema (trigger SECURITY DEFINER) escribe. No habilitamos insert directo.

create or replace function public.jd_task_audit() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  v_user := auth.uid();

  if tg_op = 'INSERT' then
    insert into public.task_history(task_id, user_id, campo, valor_anterior, valor_nuevo)
    values (new.id, v_user, 'creada', null, new.titulo);
    return new;
  end if;

  if new.estado is distinct from old.estado then
    insert into public.task_history(task_id, user_id, campo, valor_anterior, valor_nuevo)
    values (new.id, v_user, 'estado', old.estado::text, new.estado::text);
  end if;

  if new.asignado_a_id is distinct from old.asignado_a_id then
    insert into public.task_history(task_id, user_id, campo, valor_anterior, valor_nuevo)
    values (new.id, v_user, 'asignado_a_id', old.asignado_a_id::text, new.asignado_a_id::text);
  end if;

  if new.fecha_limite is distinct from old.fecha_limite then
    insert into public.task_history(task_id, user_id, campo, valor_anterior, valor_nuevo)
    values (new.id, v_user, 'fecha_limite', old.fecha_limite::text, new.fecha_limite::text);
  end if;

  if new.prioridad is distinct from old.prioridad then
    insert into public.task_history(task_id, user_id, campo, valor_anterior, valor_nuevo)
    values (new.id, v_user, 'prioridad', old.prioridad::text, new.prioridad::text);
  end if;

  return new;
end;
$$;

revoke execute on function public.jd_task_audit() from anon, authenticated, public;

drop trigger if exists trg_tasks_audit_ins on public.tasks;
create trigger trg_tasks_audit_ins
  after insert on public.tasks
  for each row execute function public.jd_task_audit();

drop trigger if exists trg_tasks_audit_upd on public.tasks;
create trigger trg_tasks_audit_upd
  after update on public.tasks
  for each row execute function public.jd_task_audit();
