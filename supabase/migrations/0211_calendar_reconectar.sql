-- Google Calendar (21/10/2026): cuando Google invalida el permiso (invalid_grant)
-- la conexión queda marcada y la plataforma deja de reintentar en cada carga.
-- Se limpia sola al volver a conectar desde Mi perfil.
alter table public.google_calendar_connections
  add column if not exists reconectar_desde timestamptz;
