-- Dos servicios nuevos, que se cobran por separado (16/9/2026):
--
--  · gestion_whatsapp — WhatsApp como canal de venta: WhatsApp Business con la
--    imagen de la marca, estrategia en estados, grupos y mensajes a los
--    contactos que ya interactuaron con el contenido.
--  · chatter — responder los mensajes de WhatsApp y filtrar las consultas
--    antes de la venta. Va dentro de la misma sección que WhatsApp pero tiene
--    su propio precio, para que la carta acuerdo cuadre los montos.
--
-- Primer cliente: Nahuel (sillones). Más adelante se suman a la web.

alter type public.service_type add value if not exists 'gestion_whatsapp';
alter type public.service_type add value if not exists 'chatter';
