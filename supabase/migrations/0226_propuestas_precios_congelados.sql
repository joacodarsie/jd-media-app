-- Cada propuesta guarda los packs (y sus precios) del día en que se armó.
--
-- La página /propuesta/[token] leía `agency_packs` en vivo: si se cambiaban los
-- precios de lista, una propuesta ya mandada mostraba el precio nuevo aunque el
-- cliente hubiera visto el viejo. El dueño eligió (30/10/2026) que lo enviado
-- no cambie: el precio nuevo vale para las propuestas que se armen desde ahora.
--
-- Las propuestas que ya existían quedan con los precios de hoy (antes de subir
-- los packs al 30% de margen).

alter table public.proposals
  add column if not exists packs_snapshot jsonb;

comment on column public.proposals.packs_snapshot is
  'Los packs de agency_packs (slug, nombre, precio_mensual, descripcion, reels, posts, dias_historias, orden) al momento de crear la propuesta. Si es null se leen en vivo.';

update public.proposals
set packs_snapshot = (
  select jsonb_agg(jsonb_build_object(
    'slug', slug, 'nombre', nombre, 'precio_mensual', precio_mensual,
    'descripcion', descripcion, 'reels', reels, 'posts', posts,
    'dias_historias', dias_historias, 'orden', orden) order by orden)
  from public.agency_packs
)
where packs_snapshot is null;
