-- Sprint 2.1: gastos operativos (no son pagos al equipo).
-- Plataformas, ads de JD, contador, impuestos, comisiones bancarias, etc.

do $$ begin
  create type expense_category as enum (
    'plataformas',     -- Notion, Google Workspace, Adobe, Canva, Figma, etc.
    'ads',             -- Meta Ads / Google Ads para JD Media propio
    'servicios',       -- Contador, abogado, asesoramiento
    'impuestos',       -- AFIP, monotributo, IIBB
    'bancos',          -- Comisiones bancarias, MercadoPago, transferencias
    'oficina',         -- Alquiler, luz, internet, insumos
    'equipamiento',    -- Compras puntuales (laptop, mic, etc.)
    'otros'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.expenses (
  id                uuid primary key default gen_random_uuid(),
  categoria         expense_category not null default 'otros',
  proveedor         text,                       -- nombre del servicio/proveedor
  concepto          text not null,
  monto             numeric(14,2) not null,
  moneda            text not null default 'ARS',
  periodo           text not null,              -- YYYY-MM (mes al que corresponde el gasto)
  fecha_programada  date,                       -- si está pendiente, cuándo se paga
  fecha_pago        date,                       -- cuándo se pagó efectivamente
  metodo_pago       text,
  recurrente        boolean not null default false,
  notas             text,
  creado_por_id     uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_expenses_periodo   on public.expenses(periodo);
create index if not exists idx_expenses_categoria on public.expenses(categoria);
create index if not exists idx_expenses_pago      on public.expenses(fecha_pago);

drop trigger if exists trg_expenses_updated on public.expenses;
create trigger trg_expenses_updated before update on public.expenses
  for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated using (public.jd_is_staff());

drop policy if exists expenses_modify on public.expenses;
create policy expenses_modify on public.expenses
  for all to authenticated
  using (public.jd_is_staff()) with check (public.jd_is_staff());
