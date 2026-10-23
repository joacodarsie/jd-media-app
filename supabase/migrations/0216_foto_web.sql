-- La foto de la web (23/10/2026): la plataforma muestra la foto original de
-- cada uno y la web (jdmedia.com.ar) una versión con fondo gris y la cabeza a
-- la misma altura que el resto del equipo. Se arma sola al subir la foto en
-- Mi perfil; cada uno elige si en la web va la gris o la original.
alter table public.users
  add column if not exists avatar_web_url text,
  add column if not exists foto_web text not null default 'gris' check (foto_web in ('gris', 'original'));

comment on column public.users.avatar_web_url is 'Foto con fondo gris para jdmedia.com.ar (se genera al subir la foto en Mi perfil).';
comment on column public.users.foto_web is 'Qué foto va en la web: gris (avatar_web_url) u original (avatar_url).';
