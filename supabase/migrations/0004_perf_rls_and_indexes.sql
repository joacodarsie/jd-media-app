-- Performance: wrap auth.uid() in (select ...) so Postgres evaluates it once per
-- query instead of once per row. Also add indexes for foreign keys flagged by
-- the Supabase performance advisor.

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (
    public.jd_is_staff()
    or asignado_a_id = (select auth.uid())
    or creado_por_id = (select auth.uid())
    or area = public.jd_area()
    or cliente_id in (
      select id from public.clients where creativa_asignada_id = (select auth.uid())
    )
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (creado_por_id = (select auth.uid()));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.jd_is_staff()
    or asignado_a_id = (select auth.uid())
    or creado_por_id = (select auth.uid())
  )
  with check (
    public.jd_is_staff()
    or asignado_a_id = (select auth.uid())
    or creado_por_id = (select auth.uid())
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated using (
    public.jd_is_staff() or creado_por_id = (select auth.uid())
  );

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated with check (
    user_id = (select auth.uid()) and task_id in (select id from public.tasks)
  );

drop policy if exists comments_modify_own on public.comments;
create policy comments_modify_own on public.comments
  for delete to authenticated using (
    user_id = (select auth.uid()) or public.jd_is_staff()
  );

drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create index if not exists idx_clients_creativa_asignada on public.clients(creativa_asignada_id);
create index if not exists idx_comments_user on public.comments(user_id);
create index if not exists idx_notifications_task on public.notifications(task_id);
create index if not exists idx_tasks_creado_por on public.tasks(creado_por_id);
