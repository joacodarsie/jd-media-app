-- Fix: la policy de team_channel_members hacía un exists() sobre team_channel_members,
-- lo cual genera recursión infinita en RLS de Postgres. Como resultado, todo
-- query con join a esa tabla devolvía vacío (incluyendo la sidebar de canales).
--
-- En chat de equipo interno no hay info sensible en quiénes son miembros, así que
-- todos los autenticados pueden ver la lista. Las restricciones reales viven en
-- team_messages (solo miembros leen mensajes del canal).

drop policy if exists tcm_select on public.team_channel_members;
create policy tcm_select on public.team_channel_members
  for select to authenticated
  using (true);
