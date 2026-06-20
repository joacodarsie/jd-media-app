-- Costo por PORCENTAJE para servicios que no son por-pieza (branding, diseño
-- suelto, web, botly, etc.): el que entrega el servicio cobra un % del monto que
-- paga el cliente (ej: branding de $400k con 50% para la diseñadora = $200k).
-- El destinatario es client_services.costo_override_user (compartido con el
-- costo fijo `costo_override`). Reglas de resolución del costo de un servicio
-- NO-gestión: si hay costo_override → monto fijo; si no, si hay costo_pct →
-- monto * costo_pct; si no, sin costo configurado.

alter table public.client_services
  add column if not exists costo_pct numeric;

comment on column public.client_services.costo_pct is
  'Costo del servicio como fracción (0–1) del monto, para servicios que no son por-pieza (branding/diseño/web/botly). Se le paga a costo_override_user. Mutuamente excluyente con costo_override (fijo).';
