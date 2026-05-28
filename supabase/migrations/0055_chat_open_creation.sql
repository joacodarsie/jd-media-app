-- Permitir a CUALQUIER autenticado crear canales (publicos o DMs).
-- Antes la policy `tc_write` requeria jd_is_staff(), entonces las chicas
-- no podian crear canales ni iniciar DMs (getOrCreateDM hace INSERT en
-- team_channels y fallaba silenciosamente).
-- Edicion/eliminacion sigue restringida a creador o staff.

drop policy if exists tc_write on public.team_channels;

drop policy if exists tc_insert on public.team_channels;
create policy tc_insert on public.team_channels
  for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists tc_update on public.team_channels;
create policy tc_update on public.team_channels
  for update to authenticated
  using (created_by = (select auth.uid()) or public.jd_is_staff())
  with check (created_by = (select auth.uid()) or public.jd_is_staff());

drop policy if exists tc_delete on public.team_channels;
create policy tc_delete on public.team_channels
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.jd_is_staff());

-- Para team_channel_members: el creador de un canal debe poder agregar a otros
-- miembros (no solo a si mismo). La policy actual solo permite si user_id ==
-- auth.uid() o jd_is_staff. Agregamos: si soy creador del canal, puedo gestionar
-- a sus miembros.

-- Tasks: permitir update a cualquier autenticado que pueda VER la tarea.
-- Antes solo podia editar el asignado, creador o staff. Ahora cualquier
-- miembro del equipo puede reasignar / editar (queda registrado en task_history).
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.jd_is_staff()
    or asignado_a_id = (select auth.uid())
    or creado_por_id = (select auth.uid())
    or area = public.jd_area()
    or cliente_id in (
      select id from public.clients where creativa_asignada_id = (select auth.uid())
    )
  )
  with check (
    public.jd_is_staff()
    or asignado_a_id = (select auth.uid())
    or creado_por_id = (select auth.uid())
    or area = public.jd_area()
    or cliente_id in (
      select id from public.clients where creativa_asignada_id = (select auth.uid())
    )
  );

drop policy if exists tcm_write on public.team_channel_members;
create policy tcm_write on public.team_channel_members
  for all to authenticated
  using (
    public.jd_is_staff()
    or user_id = (select auth.uid())
    or exists (
      select 1 from public.team_channels c
      where c.id = team_channel_members.channel_id
        and c.created_by = (select auth.uid())
    )
  )
  with check (
    public.jd_is_staff()
    or user_id = (select auth.uid())
    or exists (
      select 1 from public.team_channels c
      where c.id = team_channel_members.channel_id
        and c.created_by = (select auth.uid())
    )
  );
