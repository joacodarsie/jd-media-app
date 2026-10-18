-- Medición por publicación (17/10/2026). Pedido de un cliente (Global Business
-- Lab): cada pieza del calendario tiene que tener un porqué y algo que medir.
-- La community elige el objetivo y la meta; la plataforma mide sola el
-- resultado con los datos de Instagram unos días después de publicada.
alter table public.publications
  add column if not exists objetivo text
    check (objetivo is null or objetivo in ('conocer', 'interactuar', 'guardar', 'consultar')),
  add column if not exists meta integer check (meta is null or meta >= 0),
  -- Solo para «que consulten»: lo carga la community (Instagram no lo da).
  add column if not exists consultas_recibidas integer check (consultas_recibidas is null or consultas_recibidas >= 0),
  add column if not exists resultado jsonb,
  add column if not exists resultado_valor integer,
  add column if not exists medido_at timestamptz;

comment on column public.publications.objetivo is
  'Para qué sale la pieza: conocer (alcance), interactuar (me gusta + comentarios + guardados), guardar (guardados), consultar (consultas recibidas).';
comment on column public.publications.meta is 'Cuánto esperamos de la métrica del objetivo.';
