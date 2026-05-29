-- Director: además de lo publicado en el mes, guardamos lo subido en la SEMANA
-- (últimos 7 días) para mostrar "contratado vs subido en la semana".

alter table public.director_reports
  add column if not exists pub_reels_week int not null default 0,
  add column if not exists pub_posts_week int not null default 0;
