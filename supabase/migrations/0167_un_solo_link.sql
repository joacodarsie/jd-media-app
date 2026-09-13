-- Un solo link por publicación.
--
-- `publications` había juntado SEIS columnas para el mismo dato:
--   link_instagram · link_tiktok · link_facebook · link_publicacion ·
--   publicacion_url · ig_permalink
--
-- Es el caso más claro del "información repetida en muchos lugares" que el
-- dueño puso como prioridad A1 del backlog: seis lugares para el mismo dato
-- significan que ninguno es confiable, y el reporte del cliente terminaba
-- eligiendo entre ellos con una cascada de `||`.
--
-- Al 13/9/2026, contado antes de tocar nada:
--   link_instagram    7   ← la única con datos propios
--   ig_permalink      5   ← las 5 ya estaban también en link_instagram
--   publicacion_url   0
--   link_publicacion  0
--   link_tiktok       0
--   link_facebook     0
--
-- O sea: no se pierde un solo dato. Queda `link_instagram`, que es la red
-- principal de planificación y la única que el dueño mira para analizar
-- repercusión en el informe mensual.
--
-- `ig_media_id` NO se toca: es el identificador que usa la conciliación con
-- Instagram para no duplicar cruces, no un link.

-- Red de seguridad: si alguna fila tuviera dato en las viejas y no en la que
-- queda, se rescata antes de borrar. Con los números de arriba no debería
-- mover nada, pero el backfill cuesta nada y el borrado no se deshace.
update public.publications
set link_instagram = coalesce(
  nullif(btrim(link_instagram), ''),
  nullif(btrim(ig_permalink), ''),
  nullif(btrim(publicacion_url), ''),
  nullif(btrim(link_publicacion), ''),
  nullif(btrim(link_tiktok), ''),
  nullif(btrim(link_facebook), '')
)
where nullif(btrim(link_instagram), '') is null;

alter table public.publications
  drop column if exists ig_permalink,
  drop column if exists publicacion_url,
  drop column if exists link_publicacion,
  drop column if exists link_tiktok,
  drop column if exists link_facebook;

insert into public.review_flags (ruta, label, nota)
values (
  '/contenidos',
  'Un solo link por publicación',
  'La publicación tenía seis campos de link y ahora tiene uno solo: el de Instagram. Revisar: (1) que los links que ya estaban cargados sigan ahí, (2) que en una pieza publicada aparezca un solo campo "Link de la publicación", (3) que el reporte mensual del cliente muestre el link igual que antes, (4) que el portal de aprobación siga abriendo el posteo.'
)
on conflict do nothing;
