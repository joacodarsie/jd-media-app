-- Propuestas v2: lo que faltaba para que el generador saque documentos como
-- los que venimos armando a mano.
--
-- De dónde sale cada columna:
--
--  * cuentas        Un prospecto puede tener MÁS DE UNA cuenta con packs
--                   distintos. Catch: @barcatch en Crecimiento y @fyna.club en
--                   Presencia. Antes la propuesta mostraba los tres packs del
--                   catálogo y lo dejaba elegir, que es un catálogo, no una
--                   propuesta.
--  * descuento_monto  El descuento por llevarse varias cuentas juntas. Solo
--                   aplica con más de una.
--  * fecha_inicio   Para calcular el proporcional del primer mes: el abono se
--                   paga el 1º, así que entrar un día 9 se cobra por los días
--                   que quedan.
--  * ciudad         Cambia la letra chica de las jornadas de producción. A un
--                   prospecto de Córdoba no se le cobra traslado y hay que
--                   decírselo; al del interior, que sí se suma.
--  * contexto       La descripción y la transcripción que se cargan antes de
--                   generar. `notas` guardaba solo lo último que se pegó.

alter table public.proposals
  add column if not exists cuentas jsonb,
  add column if not exists descuento_monto integer not null default 0,
  add column if not exists fecha_inicio date,
  add column if not exists ciudad text,
  add column if not exists contexto text;

comment on column public.proposals.cuentas is
  'Array de {handle, packSlug, nota}. Una entrada por cuenta a llevar.';
comment on column public.proposals.descuento_monto is
  'Descuento mensual en pesos por llevar varias cuentas. Se ignora si hay una sola.';
comment on column public.proposals.ciudad is
  'Ciudad del prospecto. Define si las jornadas de producción llevan traslado.';

-- Las propuestas que ya existen pasan a tener una cuenta con su pack sugerido,
-- así el documento nuevo las puede pintar sin quedar vacío.
update public.proposals
   set cuentas = jsonb_build_array(
         jsonb_build_object(
           'handle', coalesce(nullif(instagram, ''), empresa),
           'packSlug', coalesce(nullif(pack_sugerido, ''), 'presencia'),
           'nota', null
         )
       )
 where cuentas is null;

insert into public.review_flags (ruta, label, nota)
values (
  '/prospeccion/propuestas',
  'Generador de propuestas v2',
  'El formulario ahora pide la descripcion del negocio, la ciudad, las cuentas con su pack y la fecha de arranque, y acepta la transcripcion en PDF. La propuesta publica se rehizo: portada clasica, el beneficio antes del precio, que se entrega el primer mes (3 de 4 semanas) y el cuadro de inversion con subtotal, descuento y total. Probar: 1) una propuesta de una sola cuenta, 2) una de dos cuentas con descuento, 3) una con ciudad Cordoba y otra de afuera, y mirar como cambia la linea de jornadas de produccion.'
)
on conflict do nothing;
