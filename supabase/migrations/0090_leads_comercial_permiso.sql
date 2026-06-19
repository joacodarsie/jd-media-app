-- Permite a usuarios con permisos.comercial = true usar el pipeline de leads
-- (leer y escribir), aunque su rol principal no sea comercial/prospecting
-- (ej: Paid Media o Edición que también venden servicios).

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (
    public.jd_is_staff()
    or asignado_a_id = (select auth.uid())
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and (
          u.rol in ('comercial', 'prospecting')
          or (u.permisos ->> 'comercial')::boolean is true
        )
    )
  );

drop policy if exists leads_write on public.leads;
create policy leads_write on public.leads
  for all to authenticated
  using (
    public.jd_is_staff()
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and (
          u.rol in ('comercial', 'prospecting')
          or (u.permisos ->> 'comercial')::boolean is true
        )
    )
  )
  with check (
    public.jd_is_staff()
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and (
          u.rol in ('comercial', 'prospecting')
          or (u.permisos ->> 'comercial')::boolean is true
        )
    )
  );
