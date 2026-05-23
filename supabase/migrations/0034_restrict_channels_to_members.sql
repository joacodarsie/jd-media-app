-- Restringir SELECT en team_channels a usuarios que son miembros del canal.
-- Antes era 'using (true)', cualquier autenticado los veía a todos. Ahora un
-- canal solo aparece para sus miembros (staff sigue viendo todos para moderar).

drop policy if exists tc_select on public.team_channels;
create policy tc_select on public.team_channels
  for select to authenticated
  using (
    public.jd_is_staff()
    or exists (
      select 1 from public.team_channel_members m
      where m.channel_id = team_channels.id
        and m.user_id = (select auth.uid())
    )
  );
