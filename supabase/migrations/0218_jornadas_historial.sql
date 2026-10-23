-- El historial de cada jornada (pedido del dueño, 23/10/2026): las jornadas se
-- pueden modificar siempre, pero cada cambio queda anotado con quién lo hizo,
-- cuándo y qué cambió (de qué valor a cuál). Así, si un monto ya cobrado o
-- pagado se toca después, se sabe.
create table if not exists public.production_session_cambios (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.production_sessions(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  accion      text not null,
  -- Una línea por cambio: "Viáticos de Carlos: $0 → $20.000".
  detalle     text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists idx_production_session_cambios_session on public.production_session_cambios(session_id, created_at desc);

-- Solo se lee y escribe desde el servidor (service_role).
alter table public.production_session_cambios enable row level security;

-- Las jornadas que ya existían arrancan con su alta en el historial.
insert into public.production_session_cambios (session_id, user_id, accion, created_at)
select ps.id, ps.creado_por_id,
       case when exists (select 1 from public.internal_meetings m where m.production_session_id = ps.id)
            then 'La agendó en la Agenda' else 'Cargó la jornada' end,
       ps.created_at
from public.production_sessions ps
where not exists (select 1 from public.production_session_cambios c where c.session_id = ps.id);
