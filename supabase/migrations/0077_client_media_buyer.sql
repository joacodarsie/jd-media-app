-- Gestor de pauta a nivel cliente, espejo de cm_id/disenador_id/audiovisual_id.
-- Aparece en el panel "Equipo asignado a esta cuenta" para dejar claro quién
-- lleva la gestión básica de campañas (ahora incluida en Gestión de redes).
alter table public.clients
  add column if not exists media_buyer_id uuid references public.users(id);

-- Backfill: si el cliente ya tiene un servicio de pauta con media buyer asignado
-- (de la migration 0072), lo usamos como gestor por defecto del cliente.
update public.clients c
set media_buyer_id = cs.media_buyer_user_id
from public.client_services cs
where cs.cliente_id = c.id
  and cs.tipo = 'paid_media'
  and cs.media_buyer_user_id is not null
  and c.media_buyer_id is null;
