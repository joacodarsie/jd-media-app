-- Descuento del contrato por MONTO FIJO, además del porcentaje ya existente.
-- El descuento sigue siendo "por los primeros N meses" (contrato_descuento_meses).
-- Regla de aplicación: si hay monto fijo (> 0) se resta ese monto; si no, se
-- aplica el porcentaje. En el form se elige uno u otro (el no elegido queda null).
alter table public.clients
  add column if not exists contrato_descuento_monto numeric(12,2);
