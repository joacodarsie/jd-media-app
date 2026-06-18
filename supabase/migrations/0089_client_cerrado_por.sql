-- Atribución comercial: quién cerró cada cliente.
-- Permite taggear clientes existentes (que no pasaron por el pipeline de leads)
-- para la vista Coordinación → Comercial. La vista usa este campo con fallback
-- a los leads ganados.

alter table public.clients
  add column if not exists cerrado_por_id uuid references public.users(id) on delete set null;

comment on column public.clients.cerrado_por_id is
  'Comercial/closer que cerró la venta de este cliente. Se usa para medir el rendimiento comercial.';

create index if not exists idx_clients_cerrado_por on public.clients(cerrado_por_id);
