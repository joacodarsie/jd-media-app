-- El buscador de emails se quedó girando sobre los mismos 40 sitios.
--
-- El problema: la tanda diaria pedía "40 contactos con sitio y sin email" sin
-- ningún orden ni marca de "ya lo intenté". Postgres devolvía siempre los
-- mismos 40, todos sitios que no publican el mail (fichas de zonaprop,
-- argenprop, yelp, facebook). Resultado: el cron corría todos los días, no
-- encontraba nada, no había a quién mandarle, y el email en frío quedó parado
-- desde el 6/8/2026 con 779 contactos que nunca se miraron.
--
-- Con esta columna cada corrida marca lo que revisó, así la tanda avanza:
-- primero los que nunca se miraron, después los más viejos (un sitio puede
-- publicar el mail meses después).

alter table public.prospecting_contacts
  add column if not exists email_buscado_at timestamptz;

-- El orden de la tanda: nulls first, después el más viejo.
create index if not exists prospecting_contacts_email_buscado_idx
  on public.prospecting_contacts (email_buscado_at nulls first)
  where email is null and sitio_web is not null;

-- Los 779 pendientes se revisaron a mano el 10/9/2026 al arreglar esto (349
-- dieron mail). Se marcan como revisados hoy para que la primera corrida del
-- cron no vuelva a bajar los mismos sitios: arranca por los que quedaron sin
-- mail recién dentro de un tiempo, cuando tenga sentido reintentarlos.
update public.prospecting_contacts
   set email_buscado_at = now()
 where email is null
   and sitio_web is not null
   and email_buscado_at is null;

insert into public.review_flags (ruta, label, nota)
values (
  '/prospeccion/email',
  'El buscador de emails ya no se traba',
  'El email en frío estaba parado desde el 6/8: el buscador revisaba todos los días los mismos 40 sitios (fichas de zonaprop/argenprop/yelp, que nunca publican el mail) y nunca llegaba a los otros 779 contactos. Ahora marca lo que revisó y va avanzando, y saltea las fichas de portales. Probar: en Prospección → Email en frío, tocar "Buscar emails" dos veces seguidas y ver que la segunda revise contactos distintos y que el número de encontrados suba. En una muestra de 30, 17 tenían el mail publicado.'
);
