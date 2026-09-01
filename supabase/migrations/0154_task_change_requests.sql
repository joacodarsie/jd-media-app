-- "Esto no me corresponde" — pedidos de cambio sobre una tarea.
--
-- Por qué existe: cuando a un diseñador le cae una tarea que no es suya, que
-- está mal cargada o que no puede hacer, hoy no tiene dónde decirlo. Lo dice
-- por WhatsApp, se pierde, y la tarea queda pudriéndose en su lista. En agosto
-- de 2026 eso derivó en 39 tareas apuntando a quien no correspondía y 28 de una
-- cuenta dada de baja que nadie iba a hacer nunca.
--
-- Ahora cualquiera puede marcar el problema desde la tarea, le llega a la
-- coordinación, y quien corresponde lo resuelve dejando registro de qué se
-- decidió.
create table if not exists public.task_change_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  solicitante_id uuid not null references public.users(id) on delete cascade,
  -- no_me_corresponde | error_en_la_tarea | falta_material | no_llego | otro
  motivo text not null,
  detalle text,
  -- pendiente | aprobada | rechazada
  estado text not null default 'pendiente',
  resuelto_por_id uuid references public.users(id) on delete set null,
  resolucion_nota text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists task_change_requests_estado_idx
  on public.task_change_requests (estado, created_at desc);
create index if not exists task_change_requests_task_idx
  on public.task_change_requests (task_id);

-- Una tarea no puede tener dos pedidos abiertos a la vez: si no, cinco clics
-- nerviosos generan cinco avisos a coordinación por lo mismo.
create unique index if not exists task_change_requests_una_abierta_idx
  on public.task_change_requests (task_id)
  where estado = 'pendiente';

alter table public.task_change_requests enable row level security;

drop policy if exists task_change_requests_read on public.task_change_requests;
create policy task_change_requests_read
  on public.task_change_requests for select
  to authenticated using (true);

drop policy if exists task_change_requests_write on public.task_change_requests;
create policy task_change_requests_write
  on public.task_change_requests for all
  to authenticated using (true) with check (true);

insert into public.review_flags (ruta, label, nota)
values (
  '/tareas',
  'Pedidos de cambio en tareas',
  'Botón "Reportar un problema" en el detalle de la tarea: el equipo marca que no le corresponde, que está mal cargada o que le falta material, y le llega a coordinación. Revisar: (1) que al reportar le llegue la notificación a coordinación, (2) que al aprobar se pueda reasignar o archivar la tarea, (3) que al resolver le llegue el aviso a quien lo reportó.'
)
on conflict do nothing;
