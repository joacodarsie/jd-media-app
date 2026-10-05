-- Objetivos por persona (pedido del dueño, 5/10/2026).
--
-- El avance se calcula solo con los datos de la app (ver lib/objetivos/equipo).
-- Acá se guarda únicamente la META cuando se pone a mano; si no hay fila, la
-- meta sale sola de lo vendido (lo que piden los packs de sus cuentas).

create table if not exists public.objetivos_persona (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  metrica text not null,
  meta_semanal numeric,
  meta_mensual numeric,
  updated_at timestamptz not null default now(),
  unique (user_id, metrica)
);

alter table public.objetivos_persona enable row level security;

drop policy if exists objetivos_persona_select on public.objetivos_persona;
create policy objetivos_persona_select on public.objetivos_persona
  for select to authenticated
  using (user_id = (select auth.uid()) or public.jd_is_staff());

-- Mati Castello, comercial: 600 leads por semana, 2.400 por mes.
insert into public.objetivos_persona (user_id, metrica, meta_semanal, meta_mensual)
select id, 'leads_contactados', 600, 2400 from public.users where email = 'mati@jdmedia.com.ar'
on conflict (user_id, metrica) do update set meta_semanal = excluded.meta_semanal, meta_mensual = excluded.meta_mensual;
