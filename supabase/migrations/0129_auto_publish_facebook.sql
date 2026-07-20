-- 0129: cross-posting a Facebook en la auto-publicación.
-- La réplica a FB es best-effort: si falla, Instagram ya salió y queda
-- registrado el error para reintentar/revisar.

alter table public.publications
  add column if not exists fb_post_id text,
  add column if not exists fb_permalink text,
  add column if not exists fb_error text;

-- Aura "sin testear".
insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/contenidos', 'Auto-publicación: réplica a Facebook + objetivos en el portal',
   'Las piezas auto-publicadas ahora salen también en la página de Facebook del cliente (posts, carruseles, reels; historias solo de imagen). Verificar una publicación en ambas redes. Además el portal del cliente muestra "🎯 Objetivos del mes" del plan mensual.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
