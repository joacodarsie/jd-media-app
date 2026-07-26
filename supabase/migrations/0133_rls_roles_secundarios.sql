-- FIX SISTÉMICO: la seguridad de la base ignoraba el ROL SECUNDARIO.
--
-- Desde la 0113 un usuario puede tener dos roles (rol + rol_secundario) y la APP
-- los respeta (userInRoles / isStaffUser), pero las políticas RLS seguían mirando
-- solo `u.rol`. Resultado: la app deja entrar a la persona y la base le rechaza
-- las escrituras EN SILENCIO (ej: Guille = paid_media + prospecting no podía
-- escribir en el pipeline de leads).
--
-- Se arregla en un solo lugar: un helper `jd_has_role` que mira los dos roles, y
-- todas las políticas afectadas pasan a usarlo (directo o vía jd_is_staff).

-- ── Helper central ───────────────────────────────────────────────────────────
create or replace function public.jd_has_role(roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and (u.rol::text = any(roles) or u.rol_secundario::text = any(roles))
  );
$$;
revoke execute on function public.jd_has_role(text[]) from anon;

-- jd_is_staff ahora vale también si admin/coordinación es el rol SECUNDARIO.
create or replace function public.jd_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.jd_has_role(array['admin','coordinador']);
$$;

-- ── leads (pipeline comercial) — 0030 / 0090 ────────────────────────────────
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (
    public.jd_is_staff()
    or asignado_a_id = (select auth.uid())
    or public.jd_has_role(array['comercial','prospecting'])
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and (u.permisos ->> 'comercial')::boolean is true
    )
  );

drop policy if exists leads_write on public.leads;
create policy leads_write on public.leads
  for all to authenticated
  using (
    public.jd_is_staff()
    or public.jd_has_role(array['comercial','prospecting'])
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and (u.permisos ->> 'comercial')::boolean is true
    )
  )
  with check (
    public.jd_is_staff()
    or public.jd_has_role(array['comercial','prospecting'])
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and (u.permisos ->> 'comercial')::boolean is true
    )
  );

-- ── client_ads_onboarding (Paid Media) — 0074 ───────────────────────────────
drop policy if exists cao_select on public.client_ads_onboarding;
create policy cao_select on public.client_ads_onboarding
  for select to authenticated using (
    public.jd_is_staff() or public.jd_has_role(array['paid_media'])
  );

drop policy if exists cao_modify on public.client_ads_onboarding;
create policy cao_modify on public.client_ads_onboarding
  for all to authenticated
  using (public.jd_is_staff() or public.jd_has_role(array['paid_media']))
  with check (public.jd_is_staff() or public.jd_has_role(array['paid_media']));

-- ── ai_generations_feedback — 0049 ──────────────────────────────────────────
drop policy if exists aigfb_select on public.ai_generations_feedback;
create policy aigfb_select on public.ai_generations_feedback
  for select using (
    (select auth.uid()) = user_id or public.jd_is_staff()
  );

-- ── internal_meetings — 0052 ────────────────────────────────────────────────
drop policy if exists internal_meetings_update on public.internal_meetings;
create policy internal_meetings_update on public.internal_meetings
  for update to authenticated
  using (created_by = (select auth.uid()) or public.jd_is_staff());

drop policy if exists internal_meetings_delete on public.internal_meetings;
create policy internal_meetings_delete on public.internal_meetings
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.jd_is_staff());

drop policy if exists internal_meeting_attendees_write on public.internal_meeting_attendees;
create policy internal_meeting_attendees_write on public.internal_meeting_attendees
  for all to authenticated
  using (
    exists (
      select 1 from public.internal_meetings m
      where m.id = meeting_id
        and (m.created_by = (select auth.uid()) or public.jd_is_staff())
    )
  )
  with check (
    exists (
      select 1 from public.internal_meetings m
      where m.id = meeting_id
        and (m.created_by = (select auth.uid()) or public.jd_is_staff())
    )
  );

-- ── freelance_contracts — 0053 ──────────────────────────────────────────────
drop policy if exists freelance_contracts_select_admin on public.freelance_contracts;
create policy freelance_contracts_select_admin on public.freelance_contracts
  for select to authenticated
  using (user_id = (select auth.uid()) or public.jd_is_staff());

drop policy if exists freelance_contracts_write_admin on public.freelance_contracts;
create policy freelance_contracts_write_admin on public.freelance_contracts
  for all to authenticated
  using (public.jd_is_staff())
  with check (public.jd_is_staff());
