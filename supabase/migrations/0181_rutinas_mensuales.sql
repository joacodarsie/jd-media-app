-- Las tareas de todos los meses, creadas solas (19/9/2026).
--
-- Lo que se repite siempre —la reunión mensual de cada cuenta, cobrarles a los
-- clientes del 1 al 5, pagarle al equipo el 7, cerrar el mes— hoy depende de
-- que alguien se acuerde. En septiembre se registraron 2 reuniones mensuales
-- sobre 16 cuentas: no es que no se hagan, es que nadie las agenda.
--
-- `rutina_key` es la marca de que una tarea la generó la rutina del mes, con
-- el período adentro ("2026-10:reunion:<cliente>"). El índice único es lo que
-- hace que correr el cron dos veces no duplique nada.

alter table public.tasks
  add column if not exists rutina_key text;

create unique index if not exists idx_tasks_rutina_key
  on public.tasks(rutina_key)
  where rutina_key is not null;

comment on column public.tasks.rutina_key is
  'Marca de tarea generada por la rutina mensual (lib/tareas/rutinas-mensuales). Único: evita duplicar al correr el cron de nuevo.';
