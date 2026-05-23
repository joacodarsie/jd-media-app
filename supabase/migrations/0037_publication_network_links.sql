-- Links por red social donde se publicó. Una misma publicación puede repostearse
-- a múltiples redes, así guardamos un link por cada una.

alter table public.publications
  add column if not exists link_instagram text,
  add column if not exists link_tiktok text,
  add column if not exists link_facebook text;
