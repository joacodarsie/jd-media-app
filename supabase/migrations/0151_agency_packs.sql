-- Packs de gestión de redes, sincronizados con jdmedia.com.ar.
--
-- Por qué: los precios estaban hardcodeados en el prompt del post-meet
-- ($350.000 / $500.000 / $700.000) mientras la web ya cobraba
-- $400.000 / $600.000 / $800.000. Cada propuesta que la IA le mandaba a un
-- prospecto cotizaba por debajo del precio real.
--
-- Misma regla que el catálogo de servicios (0150): la sincronización ACTUALIZA,
-- nunca borra. Si el parseo falla o la web cambia de diseño, queda lo último
-- que se guardó — es preferible un precio de ayer que ninguno.

create table if not exists public.agency_packs (
  slug            text primary key,          -- presencia | crecimiento | escala | personalizado
  nombre          text not null,
  precio_mensual  numeric,                   -- null = "a cotizar" (Personalizado)
  descripcion     text,
  reels           int,
  posts           int,
  dias_historias  int,
  orden           int not null default 0,
  web_synced_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.agency_packs enable row level security;

drop policy if exists agency_packs_select on public.agency_packs;
create policy agency_packs_select on public.agency_packs
  for select to authenticated using (true);

-- Semilla con lo que la web publica HOY (verificado el 2026-08-05), para que el
-- post-meet cotice bien desde el momento en que se aplique la migración, sin
-- depender de que haya corrido el cron.
insert into public.agency_packs (slug, nombre, precio_mensual, descripcion, reels, posts, dias_historias, orden)
values
  ('presencia',     'Presencia',     400000, 'Presencia ordenada y profesional. Volumen base de contenido. Ideal para empezar.', 4,  4,  8,  10),
  ('crecimiento',   'Crecimiento',   600000, 'Más volumen, estrategia más fuerte y trabajo activo de crecimiento.',              8,  8,  12, 20),
  ('escala',        'Escala',        800000, 'Full servicio. Múltiples formatos, producción fuerte, estrategia avanzada.',       12, 12, 20, 30),
  ('personalizado', 'Personalizado', null,   'Si necesitás algo distinto a los packs estándar, lo armamos a medida.',            null, null, null, 40)
on conflict (slug) do update set
  precio_mensual = excluded.precio_mensual,
  descripcion    = excluded.descripcion,
  reels          = excluded.reels,
  posts          = excluded.posts,
  dias_historias = excluded.dias_historias,
  orden          = excluded.orden,
  updated_at     = now();

insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/comercial/post-meet', 'Precios de los packs tomados de la web',
   'El mensaje post-meet cotizaba con precios viejos ($350.000 el Presencia) cuando la web ya dice $400.000. Ahora los packs salen de la base y se sincronizan solos con jdmedia.com.ar todos los días, junto con los servicios. Probá: generá un mensaje post-meet y verificá que el precio del pack que proponga coincida con el de la web. Si cambiás un precio en la web, al otro día tiene que estar acá (o tocá "Sincronizar ahora" en Documentos → Agencia).')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
