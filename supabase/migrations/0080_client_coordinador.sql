-- Coordinador/a de gestión de redes por cuenta.
-- Hasta ahora la comisión recurrente de coordinación (10%) se atribuía a TODOS
-- los usuarios con rol coordinador, lo que rompería si hubiera más de uno.
-- Modelamos el coordinador a nivel cuenta (igual que cm_id / media_buyer_id):
-- así cada cuenta tiene su coordinadora y el 10% va a quien corresponde.
--
-- Hoy Luz coordina TODAS las cuentas con servicio de gestión de redes, así que
-- el backfill las asigna al único coordinador activo.

alter table public.clients
  add column if not exists coordinador_id uuid references public.users(id) on delete set null;

comment on column public.clients.coordinador_id is
  'Coordinador/a de gestión de redes de la cuenta. Cobra la comisión recurrente de coordinación sobre el abono de gestión de redes.';

-- Backfill: a las cuentas con servicio de gestión de redes activo, asignarles el
-- coordinador activo (hoy único: Luz).
update public.clients c
set coordinador_id = (
  select u.id from public.users u
  where u.rol = 'coordinador' and u.activo
  order by u.created_at
  limit 1
)
where c.coordinador_id is null
  and exists (
    select 1 from public.client_services s
    where s.cliente_id = c.id and s.tipo = 'gestion_redes' and s.activo
  );
