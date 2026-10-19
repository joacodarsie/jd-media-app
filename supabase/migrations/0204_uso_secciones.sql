-- Qué secciones de la plataforma usa cada persona (19/10/2026). Hasta acá no
-- se sabía qué se usa y qué no: el menú tiene ~25 secciones. Una fila por
-- persona, sección y día, con la cantidad de visitas (no guarda cada clic).
create table if not exists public.uso_secciones (
  user_id uuid not null references public.users(id) on delete cascade,
  seccion text not null,
  dia date not null,
  vistas integer not null default 1,
  primary key (user_id, seccion, dia)
);

alter table public.uso_secciones enable row level security;

-- Solo el dueño lo lee desde la app; la escritura va por la función de abajo.
drop policy if exists uso_secciones_admin_lee on public.uso_secciones;
create policy uso_secciones_admin_lee on public.uso_secciones
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );

-- Suma una visita del usuario logueado a la sección, hoy (hora de Córdoba).
create or replace function public.registrar_uso(p_seccion text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.uso_secciones (user_id, seccion, dia, vistas)
  select auth.uid(), left(p_seccion, 60), (now() at time zone 'America/Argentina/Cordoba')::date, 1
  where auth.uid() is not null
  on conflict (user_id, seccion, dia) do update set vistas = public.uso_secciones.vistas + 1;
$$;

grant execute on function public.registrar_uso(text) to authenticated;
