-- Plantillas de Canva del cliente (15/10/2026). Muchos clientes las piden para
-- sumar contenido por su cuenta. Se guarda el link «Usar como plantilla» de
-- Canva (cada uno se lleva su copia y el original de la CM queda intacto). Lo
-- carga la diseñadora o la CM al terminar el arranque y el cliente lo ve en su
-- portal.
alter table public.clients add column if not exists canva_plantillas_url text;
