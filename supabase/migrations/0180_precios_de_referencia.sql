-- La lista de precios de referencia, editable desde el Cotizador (18/9/2026).
--
-- La web dejó de publicar precios: todo pasa a cotizarse a medida, según las
-- necesidades de cada cliente, para manejar mejor el margen. Pero para cotizar
-- rápido y comparar hace falta tener a mano de cuánto se parte, y esos números
-- cambian seguido: van acá, editables, y no hardcodeados en el código.
--
-- Cada fila: { id, nombre, precio, nota }.

alter table public.agency_settings
  add column if not exists precios_referencia jsonb not null default '[]'::jsonb;

comment on column public.agency_settings.precios_referencia is
  'Lista de precios de referencia para cotizar rápido: [{id, nombre, precio, nota}]. Editable en /coordinacion/cotizador.';

insert into public.review_flags (ruta, label, nota)
values (
  '/coordinacion/cotizador',
  'Precios de referencia editables',
  'La web ya no publica precios: todo se cotiza a medida. En el Cotizador hay una lista de precios de referencia editable para comparar rápido. Revisar: (1) que los números que trae sean los correctos, (2) que se pueda editar, agregar y borrar, (3) que quede guardado al recargar.'
)
on conflict do nothing;
