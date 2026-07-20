-- 0128: auto-publicación de contenidos (fase 1: Instagram)
-- Una publicación APROBADA con archivos finales subidos y auto_publicar
-- activado se publica sola en el Instagram del cliente a su fecha/hora.

alter table public.publications
  add column if not exists auto_publicar boolean not null default false,
  add column if not exists publish_media jsonb not null default '[]'::jsonb,
  add column if not exists published_at timestamptz,
  add column if not exists publish_error text,
  add column if not exists ig_media_id text,
  add column if not exists ig_permalink text;

-- Bucket PÚBLICO para los archivos finales (la API de Instagram exige que la
-- imagen/video esté en una URL pública para poder tomarla).
insert into storage.buckets (id, name, public)
values ('publish-media', 'publish-media', true)
on conflict (id) do nothing;

drop policy if exists "publish media read" on storage.objects;
create policy "publish media read" on storage.objects
  for select to public using (bucket_id = 'publish-media');

drop policy if exists "publish media insert" on storage.objects;
create policy "publish media insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'publish-media');

drop policy if exists "publish media delete" on storage.objects;
create policy "publish media delete" on storage.objects
  for delete to authenticated using (bucket_id = 'publish-media');

-- Aura "sin testear" de la feature.
insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/contenidos', 'Auto-publicación en Instagram (fase 1)',
   'En una publicación de Instagram: subir el archivo final, activar "Publicar automáticamente" y verificar que a la fecha/hora programada salga sola (el disparador corre a diario; para horario fino falta el scheduler externo). Requiere regenerar el token de Meta con instagram_content_publish.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
