-- Etapa 10: ampliar info de clientes con redes sociales y nuevos packs reales (de Notion)
alter type client_pack add value if not exists 'Personalizado';

alter table public.clients
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists web_url text,
  add column if not exists datos_facturacion text,
  add column if not exists notion_url text;
