-- Fix: cuando un contenido queda PUBLICADO, su tarea tiene que cerrarse para que
-- no le siga apareciendo como pendiente a los involucrados.
--
-- El trigger jd_sync_pub_to_task (0019) ya completa la tarea al pasar la pub a
-- 'aprobado'/'publicado', PERO solo corría on UPDATE OF estado. Si una pieza se
-- carga directo como publicada (registrar contenido que YA salió), el before-insert
-- jd_publication_autogen_task le crea una tarea 'pendiente' y, al no haber update
-- de estado, nunca se completaba → quedaba pendiente para siempre.
--
-- Ahora el sync también corre AFTER INSERT. (La función ya soporta el caso insert:
-- el corte por "estado sin cambios" solo aplica a tg_op = 'UPDATE'.)
drop trigger if exists trg_pub_sync_to_task on public.publications;
create trigger trg_pub_sync_to_task
  after insert or update of estado on public.publications
  for each row execute function public.jd_sync_pub_to_task();

-- Backfill: completar cualquier tarea AÚN abierta de piezas ya aprobadas/publicadas
-- (red de seguridad para lo que se haya cargado antes de este fix).
update public.tasks t
set estado = 'completada',
    fecha_completada = coalesce(t.fecha_completada, now())
from public.publications p
where p.task_id = t.id
  and p.estado in ('aprobado', 'publicado')
  and t.estado not in ('completada', 'archivada');
