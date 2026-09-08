-- Historial de pases de cuentas entre compañeros.
--
-- El problema: el sueldo se calculaba con el responsable ACTUAL de la ficha del
-- cliente. Pasar una cuenta de una persona a otra reescribía los meses ya
-- cerrados. Caso real: Magic y Amelia pasaron de Milena a Belén el 2/9/2026 y
-- agosto cambió solo — a Belén le aparecieron $100.000 que no trabajó y a
-- Milena le desaparecieron los mismos $100.000.
--
-- Con esta tabla, cada mes se liquida con quien la llevó de verdad, y un pase a
-- mitad de mes se reparte por días.

create table if not exists public.client_assignments (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clients(id) on delete cascade,
  -- 'cm' | 'media_buyer' | 'disenador' | 'audiovisual' | 'coordinador'
  rol text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  desde date not null,
  -- null = sigue vigente. Inclusive: ese día todavía la llevó.
  hasta date,
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists client_assignments_cliente_rol_idx
  on public.client_assignments (cliente_id, rol, desde);
create index if not exists client_assignments_user_idx
  on public.client_assignments (user_id, desde);

alter table public.client_assignments enable row level security;

drop policy if exists client_assignments_read on public.client_assignments;
create policy client_assignments_read on public.client_assignments
  for select using (auth.role() = 'authenticated');

-- La escritura va siempre por service role desde el servidor (al cambiar el
-- equipo de una cuenta), así que no se abre policy de insert/update.

-- ── Backfill ───────────────────────────────────────────────────────────────
-- Cada cuenta arranca con su responsable actual, vigente desde que arrancó la
-- cuenta. Sin esto, el primer mes que se recalcule quedaría sin nadie.
insert into public.client_assignments (cliente_id, rol, user_id, desde, hasta, nota)
select c.id, 'cm', c.cm_id, coalesce(c.fecha_inicio, '2020-01-01'::date), null,
       'backfill 0158'
from public.clients c
where c.cm_id is not null
  and not exists (
    select 1 from public.client_assignments a
    where a.cliente_id = c.id and a.rol = 'cm'
  );

insert into public.client_assignments (cliente_id, rol, user_id, desde, hasta, nota)
select c.id, 'media_buyer', c.media_buyer_id, coalesce(c.fecha_inicio, '2020-01-01'::date), null,
       'backfill 0158'
from public.clients c
where c.media_buyer_id is not null
  and not exists (
    select 1 from public.client_assignments a
    where a.cliente_id = c.id and a.rol = 'media_buyer'
  );

-- ── Corrección del pase real de septiembre 2026 ────────────────────────────
-- Magic y Amelia Ambientaciones las llevó Milena hasta agosto inclusive; el
-- 2/9/2026 pasaron a Belén. El backfill de arriba se las dio a Belén desde el
-- arranque de la cuenta, así que hay que partir el tramo.
do $$
declare
  v_mile uuid;
  v_cliente uuid;
begin
  select id into v_mile from public.users
   where lower(nombre) like '%milena%' or lower(nombre) like '%mile %'
   limit 1;
  if v_mile is null then
    raise notice '0158: no se encontro a Milena, se saltea la correccion del pase';
    return;
  end if;

  for v_cliente in
    select id from public.clients
     where nombre ilike 'magic%' or nombre ilike 'amelia%'
  loop
    -- El tramo de Belén empieza el 1/9.
    update public.client_assignments
       set desde = '2026-09-01'
     where cliente_id = v_cliente and rol = 'cm' and nota = 'backfill 0158'
       and desde < '2026-09-01';

    -- Y antes de eso la llevaba Milena.
    if not exists (
      select 1 from public.client_assignments
       where cliente_id = v_cliente and rol = 'cm' and user_id = v_mile
    ) then
      insert into public.client_assignments (cliente_id, rol, user_id, desde, hasta, nota)
      select v_cliente, 'cm', v_mile,
             coalesce(c.fecha_inicio, '2020-01-01'::date), '2026-08-31'::date,
             'pase real 2026-09: la llevaba Milena hasta agosto'
      from public.clients c where c.id = v_cliente;
    end if;
  end loop;
end $$;

-- Aura "sin testear": el dueño revisa que los sueldos de agosto vuelvan a dar
-- lo que dice la planilla de Luz.
insert into public.review_flags (ruta, label, nota)
values (
  '/coordinacion/sueldos',
  'Pase de cuentas en sueldos',
  'Los sueldos ahora respetan la fecha del pase de cuentas. Chequear agosto 2026: Milena tiene que tener Magic y Amelia (deberia dar $150.000, no $50.000) y Belen tiene que bajar a $150.000. Septiembre al reves. En la ficha del cliente, al cambiar la CM ahora se pregunta desde que fecha.'
)
on conflict do nothing;
