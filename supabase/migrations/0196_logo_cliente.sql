-- El logo de cada cliente (13/10/2026). Lo usa el carrusel de marcas de
-- jdmedia.com.ar, que ahora se arma solo con los clientes activos: el que se da
-- de baja desaparece solo y nadie tiene que acordarse de sacar su logo.
-- El archivo vive en el bucket público publish-media, carpeta logos/.
alter table public.clients add column if not exists logo_url text;
