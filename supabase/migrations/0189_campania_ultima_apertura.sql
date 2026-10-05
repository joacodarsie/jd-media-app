-- Cuándo se abrió por última vez cada campaña de prospección (pedido del
-- dueño, 5/10/2026): quiere encontrar rápido la que estuvo usando, en vez de
-- buscarla entre carpetas por rubro. La pantalla de la campaña lo marca al abrir.

alter table public.prospecting_campaigns
  add column if not exists ultima_apertura_at timestamptz;
