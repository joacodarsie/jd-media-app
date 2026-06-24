-- Split de la comisión de coordinación de Gestión de Redes por MES.
--
-- Normalmente la coordinación (comision_coordinacion, ej 10% del abono de cada
-- cuenta) la cobra entera la coordinadora de cada cuenta (clients.coordinador_id,
-- por defecto Luz). Pero algunos meses ese rol se reparte (ej: junio 2026, la
-- primera quincena la coordinó Brisa y la segunda Luz → 5% y 5%).
--
-- Esta tabla guarda, SOLO para los meses con excepción, cómo se reparte el POOL
-- de coordinación entre personas (fracciones que suman ~1). Si un mes no tiene
-- filas acá, se usa el comportamiento por defecto (todo a la coordinadora de la
-- cuenta). Así nada se rompe: es opt-in por período.
create table if not exists public.payroll_coordination_splits (
  periodo    text not null,                                   -- YYYY-MM
  user_id    uuid not null references public.users(id) on delete cascade,
  pct        numeric not null check (pct >= 0 and pct <= 1),  -- fracción del pool
  created_at timestamptz not null default now(),
  primary key (periodo, user_id)
);

alter table public.payroll_coordination_splits enable row level security;

-- Solo admin (información de nómina, igual que el resto de Sueldos).
drop policy if exists payroll_coordination_splits_admin on public.payroll_coordination_splits;
create policy payroll_coordination_splits_admin on public.payroll_coordination_splits
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol = 'admin'))
  with check (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol = 'admin'));
