-- Cuenta interna: JD MEDIA es la cuenta propia de la agencia, no un cliente.
-- No factura ni paga, no entra en recordatorios/rentabilidad ni en el conteo de
-- clientes, pero mantiene calendario, tareas y contenidos para hacerla crecer.

alter table public.clients
  add column if not exists es_interno boolean not null default false;

comment on column public.clients.es_interno is
  'true = cuenta propia de la agencia (no cliente). Excluida de finanzas y conteos; mantiene calendario/tareas.';

update public.clients set es_interno = true where nombre = 'JD MEDIA';
