-- De dónde vino cada cliente (6/10/2026).
--
-- La agencia sumó 9 cuentas en septiembre y no había forma de saber si
-- vinieron por la pauta, por un referido o por la prospección: sin ese dato no
-- se sabe dónde poner la plata. Se completa solo cuando el cliente nace de un
-- contacto de prospección o de un lead de la web; en el resto, un selector.

alter table public.clients
  add column if not exists origen text,
  add column if not exists origen_detalle text;

alter table public.clients drop constraint if exists clients_origen_check;
alter table public.clients
  add constraint clients_origen_check
  check (origen is null or origen in ('pauta', 'referido', 'prospeccion', 'web', 'redes', 'contacto_propio', 'otro'));

comment on column public.clients.origen is
  'De dónde vino el cliente: pauta, referido, prospeccion, web, redes (nos escribió por Instagram sin anuncio), contacto_propio, otro.';
comment on column public.clients.origen_detalle is
  'Detalle libre del origen; en un referido, quién lo recomendó.';

-- Lo que ya se puede saber: los que nacieron de un lead de prospección.
update public.clients c set origen = 'prospeccion'
where c.origen is null
  and exists (select 1 from public.prospecting_leads pl where pl.cliente_id = c.id);
