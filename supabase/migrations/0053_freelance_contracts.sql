-- Contratos para freelancers/colaboradores de la agencia.
-- Cada contrato pertenece a un usuario del equipo. La compensacion es libre
-- (comision, fee, por entrega, mixto) porque cada puesto se paga distinto.

do $$ begin
  create type contract_compensation as enum
    ('comision', 'fee_fijo', 'por_entrega', 'mixto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contract_status as enum
    ('borrador', 'activo', 'pausado', 'finalizado');
exception when duplicate_object then null; end $$;

create table if not exists public.freelance_contracts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users(id) on delete cascade,
  position_id          uuid references public.positions(id) on delete set null,
  rol_descripcion      text,
  compensation_type    contract_compensation not null default 'comision',
  compensation_detail  text,
  monto_referencia     numeric(12,2),
  moneda               text not null default 'ARS',
  confidentiality      boolean not null default true,
  cesion_derechos      boolean not null default true,
  no_competencia       boolean not null default false,
  fecha_inicio         date not null,
  fecha_fin            date,
  estado               contract_status not null default 'borrador',
  content_md           text,
  notas                text,
  signed_at            timestamptz,
  created_by           uuid not null references public.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists freelance_contracts_user_idx on public.freelance_contracts(user_id);
create index if not exists freelance_contracts_estado_idx on public.freelance_contracts(estado);

create or replace function public.touch_freelance_contracts()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_freelance_contracts on public.freelance_contracts;
create trigger trg_touch_freelance_contracts
  before update on public.freelance_contracts
  for each row execute function public.touch_freelance_contracts();

-- RLS: solo admin y coordinador pueden ver/modificar todos los contratos.
-- Los usuarios pueden ver SOLO sus propios contratos (read-only).
alter table public.freelance_contracts enable row level security;

drop policy if exists freelance_contracts_select_admin on public.freelance_contracts;
create policy freelance_contracts_select_admin on public.freelance_contracts
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin','coordinador')
    )
  );

drop policy if exists freelance_contracts_write_admin on public.freelance_contracts;
create policy freelance_contracts_write_admin on public.freelance_contracts
  for all to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin','coordinador')
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin','coordinador')
    )
  );
