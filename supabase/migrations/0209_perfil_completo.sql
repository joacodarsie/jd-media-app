-- Perfil completo del equipo (19/10/2026, pedido del dueño): cuando se armó la
-- plataforma nadie estaba obligado a cargar sus datos. Ahora se piden: datos
-- de facturación (para el futuro), domicilio y que cada uno confirme que sabe
-- con qué mail y contraseña entra.
alter table public.users
  add column if not exists condicion_fiscal text check (condicion_fiscal is null or condicion_fiscal in ('monotributo', 'responsable_inscripto', 'relacion_dependencia', 'ninguna')),
  add column if not exists domicilio text,
  add column if not exists acceso_confirmado_at timestamptz;
