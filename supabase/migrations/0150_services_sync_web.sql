-- Sincronización del catálogo de servicios con la web pública (jdmedia.com.ar).
--
-- La web es la fuente de verdad comercial: si ahí se agrega un servicio o se
-- cambia cómo se describe, la app tiene que reflejarlo sin que nadie lo copie
-- a mano. Esto importa más desde que los prompts de prospección leen este
-- catálogo (ver src/lib/prospecting/catalogo.ts): lo que dice la tabla es lo
-- que la IA le ofrece a un prospecto.
--
-- REGLA DE SEGURIDAD: la sincronización AGREGA y ACTUALIZA, nunca borra ni
-- desactiva. `services.slug` lo referencian los servicios contratados de cada
-- cliente; si la web se cae, cambia de diseño o el scraping falla, borrar
-- dejaría clientes con un servicio que no existe. Lo que desaparece de la web
-- se marca en `web_sync_estado` para que un humano decida.

alter table public.services
  add column if not exists web_url          text,
  add column if not exists web_synced_at    timestamptz,
  -- 'ok'          = está en la web y coincide
  -- 'no_en_web'   = existe en la app pero la web ya no lo lista (revisar a mano)
  -- 'nuevo_de_web'= lo trajo la sincronización y todavía no se revisó
  add column if not exists web_sync_estado  text,
  -- Guardamos la descripción anterior antes de pisarla: si el copy nuevo de la
  -- web queda peor para los prompts, se puede volver sin entrar a la web.
  add column if not exists description_prev text;

comment on column public.services.web_sync_estado is
  'ok | no_en_web | nuevo_de_web — resultado de la última sincronización con jdmedia.com.ar';

-- Bitácora de cada corrida: sirve para ver qué cambió y cuándo, y para no
-- depender de la memoria de nadie cuando un texto aparece distinto.
create table if not exists public.services_sync_log (
  id          uuid primary key default gen_random_uuid(),
  corrida_at  timestamptz not null default now(),
  origen      text not null default 'cron',   -- 'cron' | 'manual'
  ok          boolean not null,
  detectados  int not null default 0,
  creados     int not null default 0,
  actualizados int not null default 0,
  no_en_web   int not null default 0,
  detalle     jsonb,
  error       text
);

create index if not exists services_sync_log_fecha_idx
  on public.services_sync_log (corrida_at desc);

alter table public.services_sync_log enable row level security;

drop policy if exists services_sync_log_read on public.services_sync_log;
create policy services_sync_log_read on public.services_sync_log
  for select to authenticated using (true);

-- Semilla: dejamos anotada la URL de cada servicio que hoy existe, así la
-- primera corrida ya sabe con qué página comparar.
update public.services set web_url = 'https://jdmedia.com.ar/servicios/gestion-redes/'       where slug = 'gestion_redes'        and web_url is null;
update public.services set web_url = 'https://jdmedia.com.ar/servicios/publicidad-online/'   where slug = 'paid_media'           and web_url is null;
update public.services set web_url = 'https://jdmedia.com.ar/servicios/diseno-grafico/'      where slug = 'diseno_grafico'       and web_url is null;
update public.services set web_url = 'https://jdmedia.com.ar/servicios/produccion-contenido/' where slug = 'produccion_contenido' and web_url is null;
update public.services set web_url = 'https://jdmedia.com.ar/servicios/desarrollo-web/'      where slug = 'desarrollo_web'       and web_url is null;
update public.services set web_url = 'https://jdmedia.com.ar/servicios/botly/'               where slug = 'botly'                and web_url is null;

insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/agencia', 'Servicios sincronizados con la web',
   'En Documentos → Agencia, la tarjeta "Servicios de la agencia" ahora muestra cuándo se sincronizó con jdmedia.com.ar y tiene botón "Sincronizar ahora". Corre sola todos los días a la mañana. Probá: tocá el botón y fijate que los nombres y descripciones queden como en la web. IMPORTANTE: la sincronización nunca borra un servicio — si sacás uno de la web, en la app queda marcado "ya no está en la web" para que decidas vos (borrarlo automáticamente rompería los servicios contratados de los clientes). Si aparece un servicio NUEVO desde la web, entra al catálogo y la IA de prospección empieza a ofrecerlo, pero para poder asignárselo a un cliente hay que agregarlo antes al listado de tipos de servicio.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
