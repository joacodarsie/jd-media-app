-- La web también mide el formulario de contacto y el diagnóstico gratis de
-- Instagram (19/10/2026): hasta acá solo se contaban los clics a WhatsApp.
alter table public.web_eventos drop constraint if exists web_eventos_tipo_check;
alter table public.web_eventos add constraint web_eventos_tipo_check
  check (tipo in ('visita', 'whatsapp', 'resena', 'recurso', 'referido', 'formulario', 'diagnostico'));
