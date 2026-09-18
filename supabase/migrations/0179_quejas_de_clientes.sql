-- El registro de quejas de los clientes, por área (pedido del 18/9).
--
-- Hoy los reclamos viven en los grupos de WhatsApp y se los lleva el viento:
-- nadie puede decir si una cuenta se queja siempre de lo mismo, ni qué área es
-- la que rompe la relación. Esta tabla es ese registro, y con eso se mide la
-- calidad de la gestión de cada cuenta.
--
-- La ven y la cargan la Dirección y el área Comercial (el responsable de
-- cuentas): es información sensible sobre el trabajo del equipo, así que no es
-- para todos.

create table if not exists public.client_complaints (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clients(id) on delete cascade,
  -- El área a la que apunta la queja: diseño, CM, edición, pauta, coordinación…
  area           text not null,
  gravedad       text not null default 'media' check (gravedad in ('baja','media','alta')),
  estado         text not null default 'abierta' check (estado in ('abierta','en_proceso','resuelta')),
  -- Qué pasó, en las palabras del cliente.
  detalle        text not null,
  -- Qué se hizo. Se completa al cerrarla.
  resolucion     text,
  fecha          date not null default (now() at time zone 'America/Argentina/Cordoba')::date,
  resuelta_at    timestamptz,
  creado_por_id  uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_client_complaints_cliente on public.client_complaints(cliente_id, fecha desc);
create index if not exists idx_client_complaints_area on public.client_complaints(area);

drop trigger if exists trg_client_complaints_updated on public.client_complaints;
create trigger trg_client_complaints_updated
  before update on public.client_complaints
  for each row execute function public.set_updated_at();

alter table public.client_complaints enable row level security;

drop policy if exists client_complaints_rw on public.client_complaints;
create policy client_complaints_rw
  on public.client_complaints for all
  to authenticated
  using (public.jd_has_role(array['admin','comercial']))
  with check (public.jd_has_role(array['admin','comercial']));

insert into public.review_flags (ruta, label, nota)
values (
  '/quejas',
  'Registro de quejas de clientes',
  'Sección nueva para anotar las quejas de cada cuenta por área y ver la calidad de la gestión. Revisar: (1) que la vean solo Joaquín y Santi, (2) que se pueda cargar una queja y cerrarla con su resolución, (3) que el resumen por cuenta y por área dé los números correctos.'
)
on conflict do nothing;
