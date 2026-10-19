-- «Estoy trabado» (19/10/2026): quien tiene una tarea vencida dice qué la
-- frena (el cliente o un compañero). Le llega el aviso a quien la destraba y,
-- mientras tanto, no cuenta como atraso en el semáforo de la cuenta.
-- "Reportar un problema" (0154) existía escondido en la ficha: 0 usos.
alter table public.tasks
  add column if not exists bloqueo text check (bloqueo is null or bloqueo in ('cliente', 'persona')),
  add column if not exists bloqueo_esperando_id uuid references public.users(id) on delete set null,
  add column if not exists bloqueo_quien text,
  add column if not exists bloqueo_detalle text,
  add column if not exists bloqueo_at timestamptz;

comment on column public.tasks.bloqueo is 'Qué frena la tarea: cliente (material, aprobación) o persona (otro del equipo). null = no está trabada.';
