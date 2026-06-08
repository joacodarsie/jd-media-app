-- Suscripciones / plataformas SaaS que paga la agencia.
-- Catálogo maestro de gastos recurrentes (Notion, Adobe, Canva, etc.), distinto
-- de expenses (que es transaccional: una fila por pago de un período).
-- Cuando se paga una suscripción, desde la app se genera un expense del mes
-- (categoría plataformas) → entra al cashflow/margen real, y se avanza la
-- próxima renovación según el ciclo.

create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,                          -- Notion, Adobe CC, Canva Pro…
  categoria          public.expense_category not null default 'plataformas',
  costo              numeric(14,2) not null,
  moneda             text not null default 'ARS',
  ciclo              text not null default 'mensual'
                       check (ciclo in ('mensual','trimestral','anual')),
  proxima_renovacion date,
  metodo_pago        text,                                   -- "Visa ·1234", "MercadoPago"…
  administrador_id   uuid references public.users(id) on delete set null,
  url                text,
  activa             boolean not null default true,
  notas              text,
  creado_por_id      uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_subscriptions_activa on public.subscriptions(activa);
create index if not exists idx_subscriptions_renovacion on public.subscriptions(proxima_renovacion);

drop trigger if exists trg_subscriptions_updated on public.subscriptions;
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Mismo gate que expenses: solo staff (la página además exige feature finanzas).
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated using (public.jd_is_staff());

drop policy if exists subscriptions_modify on public.subscriptions;
create policy subscriptions_modify on public.subscriptions
  for all to authenticated
  using (public.jd_is_staff()) with check (public.jd_is_staff());
