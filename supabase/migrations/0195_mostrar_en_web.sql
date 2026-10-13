-- Qué cuentas muestran su contenido en la web de JD Media (12/10/2026).
--
-- La sección "Trabajo real" de jdmedia.com.ar se arma sola con lo último que
-- publicamos en el Instagram de cada cuenta conectada. Solo entran las cuentas
-- marcadas acá: si un cliente no quiere aparecer, se le saca la marca.
alter table public.clients
  add column if not exists mostrar_en_web boolean not null default false;

-- Arranca con las cuentas activas que ya tienen el Instagram conectado.
update public.clients
   set mostrar_en_web = true
 where estado = 'activo'
   and not es_interno
   and ig_user_id is not null;
