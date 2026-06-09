-- Fix: cualquier miembro del equipo (no solo staff) debe poder crear canales /
-- iniciar DMs. En prod seguía activa la policy vieja `tc_write` (0031) que exigía
-- jd_is_staff() para todo INSERT en team_channels, entonces un usuario no-staff
-- (ej. Guille) recibía "new row violates row-level security policy for table
-- team_channels" al abrir un mensaje directo. La 0055 ya planteaba esto pero no
-- quedó efectiva; acá la reafirmamos de forma idempotente.

-- Sacar la policy vieja FOR ALL (si todavía existe) y cualquier insert previa.
drop policy if exists tc_write on public.team_channels;
drop policy if exists tc_insert on public.team_channels;

-- INSERT: cualquier autenticado, siempre que se registre como creador.
create policy tc_insert on public.team_channels
  for insert to authenticated
  with check (created_by = (select auth.uid()));

-- UPDATE / DELETE: solo el creador del canal o staff.
drop policy if exists tc_update on public.team_channels;
create policy tc_update on public.team_channels
  for update to authenticated
  using (created_by = (select auth.uid()) or public.jd_is_staff())
  with check (created_by = (select auth.uid()) or public.jd_is_staff());

drop policy if exists tc_delete on public.team_channels;
create policy tc_delete on public.team_channels
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.jd_is_staff());
