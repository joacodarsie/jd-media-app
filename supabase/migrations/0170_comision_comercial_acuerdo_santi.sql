-- La comisión del comercial, como quedó en el acuerdo firmado con Santiago
-- Reinaldi el 14/9/2026 ("JD Media - Rol Coordinador Comercial").
--
-- Hasta acá la app pagaba OTRA cosa: 15% del primer abono por única vez más
-- una escala por cantidad de cierres (17/18/20%) y +5 puntos por lead propio.
-- Ese esquema se revisó y se descartó ("marea bastante"). Lo firmado es:
--
--   · Fijo $25.000/mes por sostener la prospección.
--   · Cliente nuevo: 10% del abono el mes 1 + 5% por mes del mes 2 al 6,
--     mientras el cliente siga. Si se va, se corta.
--   · Servicio extra a un cliente ya activo: 15% de una sola vez.
--   · Premios del mes: 3 cuentas nuevas $50.000 · 5 cuentas $150.000
--     (solo gestión de redes con abono ≥ $300.000; se cobra el más alto).
--
-- 1) `client_services.vendido_por_id`: quién vendió un servicio como EXTRA a
--    una cuenta que ya estaba activa. Sin este dato la app no tiene forma de
--    saber a quién pagarle el 15%: `clients.cerrado_por_id` es de la cuenta,
--    no del servicio, y el que cerró la cuenta no es necesariamente el que
--    después le vendió la pauta.
--
-- 2) Los porcentajes y montos en `agency_settings.rates`, para que se puedan
--    tocar desde Coordinación sin deploy. `comision_lead_propio` queda en 0 y
--    ya no se usa en ningún cálculo.

alter table public.client_services
  add column if not exists vendido_por_id uuid references public.users(id) on delete set null;

comment on column public.client_services.vendido_por_id is
  'Quién vendió este servicio como extra a una cuenta ya activa. Dispara la comisión de servicio extra (15% una vez). Los servicios que nacen con la cuenta no lo llevan.';

update public.agency_settings
set rates = coalesce(rates, '{}'::jsonb) || jsonb_build_object(
  'comercial_fijo', 25000,
  'comision_cierre', 0.10,
  'comision_residual', 0.05,
  'comision_residual_meses', 5,
  'comision_servicio_extra', 0.15,
  'premio_3_cuentas', 50000,
  'premio_5_cuentas', 150000,
  'premio_abono_minimo', 300000,
  'comision_lead_propio', 0
)
where id = 1;

-- Que el dueño vea con sus ojos cómo quedó la nómina del comercial.
insert into public.review_flags (ruta, label, nota)
values (
  '/coordinacion/sueldos',
  'Comisión del comercial según el acuerdo con Santi',
  'La nómina paga ahora 10% el mes 1 + 5% del mes 2 al 6 por cliente nuevo, 15% una vez por servicio extra (campo "Vendido por" en el servicio) y los premios de 3 y 5 cuentas. Se sacaron los escalones y el lead propio. Revisar el "cómo se paga cada puesto" y el diálogo de comisión manual.'
)
on conflict do nothing;
