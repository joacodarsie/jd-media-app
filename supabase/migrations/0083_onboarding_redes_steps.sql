-- Onboarding · etapa de Gestión de Redes (a cargo de la coordinadora del servicio).
-- Nuevos pasos clave para dejar la cuenta correctamente iniciada:
--  - Drive del cliente creado (la carpeta vive en Clientes del Drive de JD Media,
--    con sub-carpetas: Identidad visual, Calendario de contenidos, Contenido crudo).
--    El link se guarda en clients.drive_url (ya existente) y se muestra en el calendario.
--  - Accesos del cliente cargados (IG / TikTok / Facebook + lo que pase el cliente),
--    se guardan en clients.credenciales (ya existente).
--  - Rediseño de perfiles y biografías realizado.
alter table public.client_onboarding
  add column if not exists drive_creado_at      timestamptz,
  add column if not exists accesos_cargados_at  timestamptz,
  add column if not exists perfiles_rediseno_at timestamptz;
