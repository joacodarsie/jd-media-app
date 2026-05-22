-- C11: imputación de gastos y pagos a clientes (opcional) para rentabilidad por cliente.
alter table public.expenses
  add column if not exists cliente_id uuid references public.clients(id) on delete set null;

alter table public.team_payments
  add column if not exists cliente_id uuid references public.clients(id) on delete set null;

create index if not exists idx_expenses_cliente on public.expenses(cliente_id);
create index if not exists idx_team_payments_cliente on public.team_payments(cliente_id);
