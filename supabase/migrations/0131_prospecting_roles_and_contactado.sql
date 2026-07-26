-- Dos cosas para Prospección:
--
-- 1) RLS por ROL SECUNDARIO: las políticas de prospección solo miraban el rol
--    PRIMARIO (comercial/prospecting). Guille es paid_media con rol_secundario
--    'prospecting' → entraba a la página pero no podía escribir. Recreamos las 3
--    políticas para que también valga el rol secundario.
--
-- 2) `contactado_at` en contactos rápidos: para controlar mejor a quién ya se
--    contactó y hace cuánto (seguimiento). Se sella al marcar el contacto como
--    contactado/interesado/descartado.

alter table public.prospecting_contacts
  add column if not exists contactado_at timestamptz;

-- ── RLS que suma el rol secundario ───────────────────────────────────────────
drop policy if exists prospecting_campaigns_all on public.prospecting_campaigns;
create policy prospecting_campaigns_all on public.prospecting_campaigns
  for all to authenticated
  using (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid())
      and (u.rol in ('comercial','prospecting') or u.rol_secundario in ('comercial','prospecting')))
  )
  with check (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid())
      and (u.rol in ('comercial','prospecting') or u.rol_secundario in ('comercial','prospecting')))
  );

drop policy if exists prospecting_leads_all on public.prospecting_leads;
create policy prospecting_leads_all on public.prospecting_leads
  for all to authenticated
  using (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid())
      and (u.rol in ('comercial','prospecting') or u.rol_secundario in ('comercial','prospecting')))
  )
  with check (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid())
      and (u.rol in ('comercial','prospecting') or u.rol_secundario in ('comercial','prospecting')))
  );

drop policy if exists prospecting_contacts_all on public.prospecting_contacts;
create policy prospecting_contacts_all on public.prospecting_contacts
  for all to authenticated
  using (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid())
      and (u.rol in ('comercial','prospecting') or u.rol_secundario in ('comercial','prospecting')))
  )
  with check (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid())
      and (u.rol in ('comercial','prospecting') or u.rol_secundario in ('comercial','prospecting')))
  );
