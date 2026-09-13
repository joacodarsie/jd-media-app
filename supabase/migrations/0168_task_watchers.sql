-- Seguir un ticket que no es tuyo.
--
-- Pedido del 13/9: "Jira te buchonea, que me notifique cualquier cambio". La
-- pieza que falta para eso son los seguidores: hoy solo se entera quien tiene
-- la tarea asignada, así que la coordinación se entera de los cambios cuando
-- pregunta.
--
-- El responsable y quien la creó NO necesitan una fila acá: se los considera
-- seguidores por definición. Esta tabla es solo para el tercero que quiere
-- enterarse — típicamente la Project Manager o la Dirección Creativa sobre una
-- pieza que no es suya.
create table if not exists public.task_watchers (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists idx_task_watchers_user on public.task_watchers(user_id);

alter table public.task_watchers enable row level security;

drop policy if exists task_watchers_read on public.task_watchers;
create policy task_watchers_read
  on public.task_watchers for select
  to authenticated using (true);

-- Cada uno se sigue y se deja de seguir a sí mismo. Nadie puede poner a otro
-- a seguir un ticket: sería una forma elegante de llenarle las notificaciones.
drop policy if exists task_watchers_write on public.task_watchers;
create policy task_watchers_write
  on public.task_watchers for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.review_flags (ruta, label, nota)
values (
  '/tareas',
  'Avisos de cambios y seguir un ticket',
  'Ahora la app avisa cuando te asignan una tarea o cuando cambia la fecha de una tuya, y podés SEGUIR un ticket que no es tuyo para enterarte igual. Revisar: (1) que al asignarle una tarea a alguien le llegue el aviso, (2) que al cambiar una fecha le avise al responsable, (3) que NO te avise de tus propios cambios, (4) que el botón Seguir aparezca y sume el aviso.'
)
on conflict do nothing;
