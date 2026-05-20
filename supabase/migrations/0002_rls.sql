-- =====================================================================
-- JD Media · Row Level Security
-- Ejecutar este archivo SEGUNDO (después de 0001_init.sql)
-- =====================================================================

-- Helpers SECURITY DEFINER: leen el perfil sin disparar RLS (evita recursión)
create or replace function public.jd_role() returns user_role
language sql stable security definer set search_path = public as $$
  select rol from public.users where id = auth.uid();
$$;

create or replace function public.jd_area() returns text
language sql stable security definer set search_path = public as $$
  select area from public.users where id = auth.uid();
$$;

create or replace function public.jd_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.jd_role() in ('admin','coordinador'), false);
$$;

alter table public.users         enable row level security;
alter table public.clients       enable row level security;
alter table public.tasks         enable row level security;
alter table public.comments      enable row level security;
alter table public.notifications enable row level security;

-- ---------- users ----------
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated using (true);

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists users_admin_all on public.users;
create policy users_admin_all on public.users
  for all to authenticated
  using (public.jd_role() = 'admin') with check (public.jd_role() = 'admin');

-- ---------- clients ----------
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select to authenticated using (true);

drop policy if exists clients_write_staff on public.clients;
create policy clients_write_staff on public.clients
  for all to authenticated
  using (public.jd_is_staff()) with check (public.jd_is_staff());

-- ---------- tasks ----------
-- Ver: staff ve todo; el resto ve sus tareas, las de su área
-- y las de los clientes que tiene asignados.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (
    public.jd_is_staff()
    or asignado_a_id = auth.uid()
    or creado_por_id = auth.uid()
    or area = public.jd_area()
    or cliente_id in (
      select id from public.clients where creativa_asignada_id = auth.uid()
    )
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (creado_por_id = auth.uid());

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated using (
    public.jd_is_staff()
    or asignado_a_id = auth.uid()
    or creado_por_id = auth.uid()
  ) with check (true);

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated using (
    public.jd_is_staff() or creado_por_id = auth.uid()
  );

-- ---------- comments ----------
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using (
    task_id in (select id from public.tasks)
  );

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated with check (
    user_id = auth.uid() and task_id in (select id from public.tasks)
  );

drop policy if exists comments_modify_own on public.comments;
create policy comments_modify_own on public.comments
  for delete to authenticated using (
    user_id = auth.uid() or public.jd_is_staff()
  );

-- ---------- notifications ----------
drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications
  for insert to authenticated with check (true);
