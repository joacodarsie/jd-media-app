-- Nuevo rol: Coordinación de Diseño Gráfico (distinto de la coordinación de
-- gestión de redes). Bri lo usa como rol secundario: es diseñadora (primario) y
-- coordinadora del servicio de diseño (secundario). Coordina el servicio de
-- diseño gráfico y aprueba la identidad visual en el arranque de cada cuenta.
alter type public.user_role add value if not exists 'coordinador_diseno';
