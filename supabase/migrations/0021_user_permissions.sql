-- Permisos granulares por usuario. Admin siempre tiene todos.
-- Shape: { "finanzas": true, "global": true, ... }
alter table public.users
  add column if not exists permisos jsonb not null default '{}'::jsonb;

-- Función helper para chequear desde RLS o triggers
create or replace function public.jd_user_has(uid uuid, feature text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    case
      when not exists (select 1 from public.users where id = uid) then false
      else coalesce(
        (select rol = 'admin' from public.users where id = uid),
        false
      )
      or coalesce(
        (select (permisos ->> feature)::boolean from public.users where id = uid),
        false
      )
    end;
$$;

grant execute on function public.jd_user_has(uuid, text) to authenticated;
