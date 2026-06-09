-- Fix real del "row violates RLS policy for table team_channels" al iniciar un
-- DM o crear un canal siendo no-staff.
--
-- Diagnóstico: el INSERT en sí pasaba bien (tc_insert: created_by = auth.uid()).
-- Lo que fallaba era el READ-BACK: el código hace `.insert(...).select()`, que
-- agrega un RETURNING y exige que la fila recién creada pase la policy de SELECT
-- (tc_select). Pero tc_select solo permitía ver canales donde el usuario YA es
-- miembro (o es staff), y un canal recién creado todavía no tiene miembros.
-- Por eso el admin podía (pasa por jd_is_staff()) y el resto no.
--
-- Fix: el creador del canal puede verlo aunque todavía no haya filas de
-- membership. Resuelve getOrCreateDM y createChannel de una.

drop policy if exists tc_select on public.team_channels;
create policy tc_select on public.team_channels
  for select to authenticated
  using (
    public.jd_is_staff()
    or created_by = (select auth.uid())
    or exists (
      select 1 from public.team_channel_members m
      where m.channel_id = team_channels.id
        and m.user_id = (select auth.uid())
    )
  );
