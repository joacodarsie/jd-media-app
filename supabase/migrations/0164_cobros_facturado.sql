-- ¿Este cobro salió con factura o no?
--
-- Hasta ahora la app registraba que el cliente pagó, pero no si esa plata se
-- facturó. Es el dato que falta para ARCA: sin él no hay forma de saber cuánto
-- de lo que entra está en blanco, ni cuántas facturas quedaron sin hacer.
-- Todo eso vivía en la cabeza del dueño.
--
-- Tres campos, y solo el primero es obligatorio:
--  * `facturado`: el sí/no. Arranca en false para todo lo que ya existe, que es
--    lo correcto: si nadie lo marcó, no hay constancia de que se haya facturado.
--  * `factura_nro`: el número, para poder cruzarlo con el talonario de ARCA.
--  * `facturado_at`: cuándo se hizo. Puede caer en otro mes que el cobro
--    (facturás en septiembre algo que cobraste en agosto), y el período fiscal
--    se rige por esta fecha, no por la del cobro.
alter table public.client_invoices
  add column if not exists facturado boolean not null default false,
  add column if not exists factura_nro text,
  add column if not exists facturado_at date;

-- Para el filtro "sin factura", que es la pregunta que se hace a fin de mes.
create index if not exists idx_invoices_facturado
  on public.client_invoices (facturado, periodo);

insert into public.review_flags (ruta, label, nota)
values (
  '/finanzas/cobros',
  'Factura sí/no en cada cobro',
  'Cada fila de Cuentas por cobrar tiene ahora un chip Factura / Sin factura que se toca para cambiarlo, y arriba un filtro "Sin factura". Revisar: (1) que el chip cambie de estado con un clic y quede así al recargar, (2) que seleccionando varias filas aparezca "Marcar facturadas" y funcione en bloque, (3) que el resumen de arriba diga cuánto de lo cobrado está facturado, (4) que el número de factura se pueda cargar al editar el cobro.'
)
on conflict do nothing;
