-- Registrar cuánto pagó el cliente en el paso "pago recibido" del onboarding.
-- Algunos clientes señan el servicio (pago parcial) y abonan el resto más
-- adelante: guardamos el monto efectivamente recibido + una nota para poder
-- calcular cuánto deben todavía.

alter table public.client_onboarding
  add column if not exists pago_recibido_monto numeric,
  add column if not exists pago_recibido_nota text;

comment on column public.client_onboarding.pago_recibido_monto is
  'Monto efectivamente recibido en el primer pago (puede ser una seña parcial).';
comment on column public.client_onboarding.pago_recibido_nota is
  'Aclaración del pago: ej. "señó 50%, abona el resto el 15".';
