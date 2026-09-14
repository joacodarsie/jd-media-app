-- La Dirección Creativa (Brisa Tejada), según su acuerdo de rol del 14/9/2026.
--
-- Hasta agosto cobraba la "coordinación de diseño": 5% del diseño publicado más
-- un plus por manual aprobado. En septiembre eso le dejaba $3.400 por aprobar el
-- trabajo de toda la agencia, al revés del rol que se le dio el 13/9.
--
-- Desde el 15/9/2026 cobra el 5% del abono de gestión de redes de cada cuenta
-- activa, el mismo modelo que la coordinación de la Project Manager. Septiembre
-- va por la mitad (lo resuelve el código, `lib/payroll/direccion-creativa.ts`).
-- Pasa al 10% cuando cumpla tres meses los números del rol y la agencia tenga
-- 20 cuentas activas: eso se decide en la revisión y se cambia desde Coordinación.

update public.agency_settings
set rates = coalesce(rates, '{}'::jsonb) || jsonb_build_object('comision_direccion_creativa', 0.05)
where id = 1;
