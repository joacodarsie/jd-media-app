-- Fix: "infinite recursion detected in policy for relation team_channels".
--
-- La migracion 0033 habia resuelto la recursion dejando el SELECT de
-- team_channel_members en `using (true)` (tcm_select), porque tc_select
-- (team_channels, 0034) hace un subquery a team_channel_members. Si ESE
-- subquery a su vez evalua una policy que vuelve a team_channels, Postgres
-- detecta el ciclo y aborta.
--
-- La migracion 0055 reintrodujo el ciclo: creo `tcm_write` como `FOR ALL`,
-- que tambien aplica al SELECT, y su USING hace `exists (... team_channels ...)`.
-- Resultado: SELECT channels -> SELECT members (tcm_write) -> SELECT channels
-- (tc_select) -> ... recursion.
--
-- Solucion: el SELECT de members debe quedar SOLO en tcm_select (using true).
-- Las reglas de escritura (creador del canal puede gestionar miembros) se
-- mantienen, pero acotadas a insert/update/delete, que nunca se evaluan durante
-- un SELECT y por lo tanto no recrean el ciclo.

drop policy if exists tcm_write on public.team_channel_members;

-- Aseguramos que el SELECT siga siendo abierto a autenticados (no hay info
-- sensible en quien es miembro; los mensajes si estan restringidos aparte).
drop policy if exists tcm_select on public.team_channel_members;
create policy tcm_select on public.team_channel_members
  for select to authenticated
  using (true);

create policy tcm_insert on public.team_channel_members
  for insert to authenticated
  with check (
    public.jd_is_staff()
    or user_id = (select auth.uid())
    or exists (
      select 1 from public.team_channels c
      where c.id = team_channel_members.channel_id
        and c.created_by = (select auth.uid())
    )
  );

create policy tcm_update on public.team_channel_members
  for update to authenticated
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

create policy tcm_delete on public.team_channel_members
  for delete to authenticated
  using (
    public.jd_is_staff()
    or user_id = (select auth.uid())
    or exists (
      select 1 from public.team_channels c
      where c.id = team_channel_members.channel_id
        and c.created_by = (select auth.uid())
    )
  );
