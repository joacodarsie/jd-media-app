-- Aura "sin testear": cada feature nueva que crea Claude queda marcada hasta que
-- el dueño la revisa y la aprueba. El layout (app) muestra un banner amarillo en
-- las rutas flageadas (solo admin) y el botón "Aprobar" la limpia.

create table if not exists public.review_flags (
  id          uuid primary key default gen_random_uuid(),
  -- Ruta de la app donde vive lo nuevo; matchea por prefijo ('/finanzas/panorama').
  ruta        text not null,
  -- Qué es lo nuevo, en criollo.
  label       text not null,
  -- Qué conviene mirar/probar al testearlo.
  nota        text,
  created_at  timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);

create index if not exists idx_review_flags_active
  on public.review_flags (ruta)
  where approved_at is null;

alter table public.review_flags enable row level security;

-- Lectura para staff; las escrituras van por service_role (server actions),
-- así que no hay policy de write.
drop policy if exists review_flags_read on public.review_flags;
create policy review_flags_read on public.review_flags
  for select to authenticated
  using (public.jd_is_staff());

-- Seed: lo nuevo de la sesión 2026-07-11/13 que quedó sin eyeball del dueño.
insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/finanzas/panorama', 'Panorama financiero',
   'Planilla estilo Excel: abonos editables inline, costos fijos, modelo vs real, avisos de cuentas sin equipo. Comparar contra el Sheet SIEMPRE con un mes cerrado.'),
  ('/coordinacion/sueldos', 'Sueldos en 3 vistas + comisión de Leo',
   'Resumen por puesto / Por persona / Cómo se paga cada puesto. En julio Leo (coord general) debe figurar con $220.000 (5% de $4.400.000).'),
  ('/objetivos', 'Barra de progreso en Objetivos',
   'Los objetivos con meta muestran barra (ej 15/50 clientes). Probar editar el avance inline y "+ medir con una meta".'),
  ('/agencia', 'Hub institucional: "Roles y acciones por puesto"',
   'Página nueva en Fundamentos. En /procesos también está "Ingreso de un colaborador nuevo".'),
  ('/clientes', 'Aviso de equipo incompleto por servicio',
   'Cuentas sin CM/diseño/edición según sus servicios: borde ámbar + badge "falta …". Magic debería aparecer marcada hasta que le asignes equipo.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
