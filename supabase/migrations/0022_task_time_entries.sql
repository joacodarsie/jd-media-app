-- Time-tracking simple por tarea.
-- Cada entry tiene start y end (null mientras está corriendo).
create table if not exists public.task_time_entries (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  started_at  timestamptz not null default now(),
  stopped_at  timestamptz,
  duration_seg integer generated always as (
    case
      when stopped_at is null then null
      else extract(epoch from (stopped_at - started_at))::int
    end
  ) stored,
  notas       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_tte_task on public.task_time_entries(task_id, started_at desc);
create index if not exists idx_tte_user on public.task_time_entries(user_id, started_at desc);
-- Como mucho una sesión "abierta" (sin stop) por user.
create unique index if not exists uq_tte_open_per_user
  on public.task_time_entries(user_id)
  where stopped_at is null;

alter table public.task_time_entries enable row level security;

-- Cualquier user autenticado que pueda ver la tarea, ve sus tiempos.
drop policy if exists tte_select on public.task_time_entries;
create policy tte_select on public.task_time_entries
  for select to authenticated using (true);

-- Solo el dueño puede crear/editar sus entries.
drop policy if exists tte_insert on public.task_time_entries;
create policy tte_insert on public.task_time_entries
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists tte_update on public.task_time_entries;
create policy tte_update on public.task_time_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists tte_delete on public.task_time_entries;
create policy tte_delete on public.task_time_entries
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.jd_is_staff());
