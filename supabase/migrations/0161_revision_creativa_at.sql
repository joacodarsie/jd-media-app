-- "Revisión creativa" no tenía dueño ni reloj.
--
-- Cuando diseño o edición termina, cierra SU tarea y la pieza pasa a
-- `revision_creativa`. Como el aviso diario de vencidas mira `tasks` y ahí ya
-- no queda ninguna abierta, la pieza deja de aparecer en el radar de todos.
-- Al 10/9/2026 había dos piezas de Ana Monjes esperando revisión hacía 19 y 20
-- días ("Alarmas" de Boxescar y "Tu auto no puede parar" de Lubricentro) sin
-- que nadie supiera que existían.
--
-- Con esta marca se puede medir cuánto lleva esperando y avisarle al CM, y
-- escalar a coordinación cuando pasa de 3 días.

alter table public.publications
  add column if not exists revision_creativa_at timestamptz;

create index if not exists publications_revision_creativa_idx
  on public.publications (revision_creativa_at)
  where estado = 'revision_creativa';

-- Backfill de las que ya están esperando: se toma el momento en que se cerró
-- la tarea de producción, que es cuando la pieza entró de verdad a revisión.
-- Si no hay tarea cerrada, queda null y el aviso mide desde la fecha en que la
-- pieza debía salir, que para estas ya pasó.
update public.publications p
   set revision_creativa_at = t.updated_at
  from public.tasks t
 where p.task_id = t.id
   and p.estado = 'revision_creativa'
   and p.revision_creativa_at is null
   and t.estado = 'completada';
