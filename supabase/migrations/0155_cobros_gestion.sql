-- Seguimiento del cobro: en qué etapa está y los pagos parciales.
--
-- Hasta ahora el cobro era binario: pagó o no pagó. En la realidad hay un medio
-- que es donde se pierde la plata: le escribiste y no contestó, dijo que pagaba
-- el viernes, o te dio una parte y te debe el resto. Todo eso vivía en la
-- cabeza del dueño y en el chat de WhatsApp, así que a fin de mes no se sabía a
-- quién había que insistirle.
--
-- Dos piezas:
--  * `gestion_estado` en la factura: en qué punto de la conversación está.
--  * `invoice_payments`: cada entrega parcial, con su fecha y su nota. La
--    factura queda cobrada cuando la suma llega al total.
alter table public.client_invoices
  add column if not exists gestion_estado text,
  add column if not exists gestion_at timestamptz;

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.client_invoices(id) on delete cascade,
  monto numeric not null check (monto > 0),
  fecha date not null default current_date,
  medio text,
  nota text,
  creado_por_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invoice_payments_invoice_idx
  on public.invoice_payments (invoice_id, fecha);

alter table public.invoice_payments enable row level security;

drop policy if exists invoice_payments_read on public.invoice_payments;
create policy invoice_payments_read
  on public.invoice_payments for select
  to authenticated using (true);

drop policy if exists invoice_payments_write on public.invoice_payments;
create policy invoice_payments_write
  on public.invoice_payments for all
  to authenticated using (true) with check (true);

insert into public.review_flags (ruta, label, nota)
values (
  '/cobros',
  'Seguimiento del cobro: etapa, pagos parciales y aclaraciones',
  'En ¿Quién me pagó? cada fila ahora tiene la etapa (sin contactar / le escribí / prometió pagar / pagó) y permite cargar entregas parciales. Revisar: (1) que al cargar una entrega parcial el saldo baje y quede la fecha, (2) que al completar el total la fila se marque cobrada sola, (3) que la aclaración se guarde y se vea, (4) que "Falta cobrar" arriba descuente lo entregado a cuenta.'
)
on conflict do nothing;
