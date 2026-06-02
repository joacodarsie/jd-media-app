-- Equipo POR SERVICIO: cada servicio de un cliente puede tener sus propias
-- personas asignadas (además del CM/diseñador/audiovisual a nivel cliente).
-- Se les notifica cuando el servicio se crea.

alter table public.client_services
  add column if not exists responsables uuid[] not null default '{}';

comment on column public.client_services.responsables is
  'IDs de usuarios que llevan este servicio. Se les notifica al crear el servicio. Complementa el equipo a nivel cliente (cm_id/disenador_id/audiovisual_id).';
