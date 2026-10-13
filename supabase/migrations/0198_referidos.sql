-- Programa de referidos (13/10/2026). Decisión del dueño: 10% para los dos.
--
-- * Cada cliente tiene un código propio (`clients.ref_code`) para su link
--   jdmedia.com.ar/?ref=CODIGO. No es el token del portal: ese da acceso a la
--   cuenta y no puede andar circulando.
-- * `referidos`: quién recomendó a quién. Pendiente → ganado (el recomendado
--   pagó su 2.º mes) → aplicado (el 10% ya salió como línea negativa en la
--   factura del que recomendó). Lo mueve el cron; nadie lo carga a mano.
-- * `web_eventos` suma el tipo 'referido' (alguien entró a la web con un link
--   de recomendación) y el código.

alter table public.clients add column if not exists ref_code text;
update public.clients
  set ref_code = lower(substr(md5(random()::text || id::text), 1, 6))
  where ref_code is null;
alter table public.clients alter column ref_code set default lower(substr(md5(random()::text), 1, 6));
create unique index if not exists clients_ref_code_key on public.clients (ref_code);

create table if not exists public.referidos (
  id uuid primary key default gen_random_uuid(),
  recomienda_id uuid not null references public.clients(id) on delete cascade,
  nuevo_id uuid not null unique references public.clients(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'ganado', 'aplicado')),
  ganado_at timestamptz,
  aplicado_periodo text,
  monto_descuento numeric,
  invoice_id uuid references public.client_invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  check (recomienda_id <> nuevo_id)
);
create index if not exists idx_referidos_recomienda on public.referidos (recomienda_id);
alter table public.referidos enable row level security;
-- Sin políticas: lo leen y escriben las acciones del servidor (service role).

alter table public.web_eventos drop constraint if exists web_eventos_tipo_check;
alter table public.web_eventos
  add constraint web_eventos_tipo_check check (tipo in ('visita', 'whatsapp', 'resena', 'recurso', 'referido'));
alter table public.web_eventos add column if not exists ref text;

-- ¿Ya se le puso el 10% del primer mes al recomendado? Una propuesta todavía
-- no tiene fecha de inicio: el descuento se carga cuando arranca.
alter table public.referidos add column if not exists descuento_nuevo boolean not null default false;
