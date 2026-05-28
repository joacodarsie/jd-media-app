-- Migration 0059: agrega estado "archivada" al enum task_status
-- Las tareas completadas hace +30 días se auto-archivan via cron diario.
-- Las vistas excluyen "archivada" por defecto; el filtro "Todas" las incluye.

alter type task_status add value if not exists 'archivada';
