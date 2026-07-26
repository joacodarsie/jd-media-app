-- Mensajes ideales por campaña: al crear una campaña (o con un botón), la IA
-- arma la plantilla de mensajes para ese cluster —primer mensaje + una
-- alternativa + 2 seguimientos— que el director copia y adapta con el nombre de
-- cada empresa del rubro. Se guarda en la campaña como jsonb.
alter table public.prospecting_campaigns
  add column if not exists mensajes_plantilla jsonb;

insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/prospeccion', 'Mensajes ideales por campaña',
   'Entrá a una campaña: arriba aparece "Mensajes de la campaña" con el primer mensaje + alternativa + 2 seguimientos, generados por IA para ese rubro. Probá el botón Copiar de cada uno y "Regenerar". Se generan solos al crear una campaña (si sos el director).')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
