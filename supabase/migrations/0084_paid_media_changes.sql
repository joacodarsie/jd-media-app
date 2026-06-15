-- Registro de cambios aplicados a campañas/conjuntos de Meta desde la app
-- (Fase 2 de Paid Media). Sirve de auditoría y para revertir (rollback).
create table if not exists public.paid_media_changes (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clients(id) on delete cascade,
  tipo            text not null,            -- presupuesto | pausar | activar
  nivel           text not null,            -- campaña | conjunto
  target_id       text not null,            -- id de la campaña/conjunto en Meta
  target_nombre   text,
  valor_anterior  text,                     -- ppto anterior (en moneda) o estado anterior
  valor_nuevo     text,
  motivo          text,
  estado          text not null default 'aplicado',  -- aplicado | revertido
  aplicado_por    uuid references public.users(id),
  aplicado_at     timestamptz not null default now(),
  revertido_at    timestamptz
);
create index if not exists idx_pmc_cliente on public.paid_media_changes(cliente_id, aplicado_at desc);

-- Acceso vía service_role en el server (tras chequear rol admin/paid_media).
-- Sin policies públicas → RLS bloquea acceso directo.
alter table public.paid_media_changes enable row level security;
