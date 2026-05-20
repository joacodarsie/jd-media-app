-- Security hardening based on Supabase advisors
-- 1) Add stable search_path to remaining functions
-- 2) Tighten RLS WITH CHECK on tasks_update and notifications insert
-- 3) Revoke EXECUTE on trigger-only SECURITY DEFINER functions
-- 4) Revoke EXECUTE from anon on internal helpers

-- ---------- function hardening ----------
create or replace function public.is_area(v text) returns boolean
language sql immutable
set search_path = public
as $$
  select v in (
    'Estrategia/Dirección','Coordinación','Paid Media','Prospecting','Comercial',
    'Creativas','Community Manager','Edición Audiovisual','Desarrollo Web','Botly','Diseño'
  );
$$;

create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- RLS tightening ----------
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.jd_is_staff()
    or asignado_a_id = auth.uid()
    or creado_por_id = auth.uid()
  )
  with check (
    public.jd_is_staff()
    or asignado_a_id = auth.uid()
    or creado_por_id = auth.uid()
  );

-- Notifications insert only via trigger (SECURITY DEFINER bypasses RLS).
-- No need for an authenticated INSERT policy.
drop policy if exists notif_insert on public.notifications;

-- ---------- revoke EXECUTE on trigger-only functions ----------
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.notify_assignment() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;

-- ---------- revoke EXECUTE from anon on internal helpers ----------
revoke execute on function public.jd_role() from anon;
revoke execute on function public.jd_area() from anon;
revoke execute on function public.jd_is_staff() from anon;
