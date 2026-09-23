-- Servicio nuevo (23/9/2026): google_ads — "Google Ads y Google Business".
--
-- Campañas de búsqueda en Google y la ficha de Google Business (Maps) al día.
-- Se vende como extra de la gestión de redes, con su propio precio, igual que
-- la gestión de WhatsApp: así la carta acuerdo muestra su alcance aparte.
--
-- Primer cliente: Warrior (Presencia + Google, $100.000).

alter type public.service_type add value if not exists 'google_ads';
