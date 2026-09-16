-- El responsable de cada cuenta, y la cartera del comercial.
--
-- Acuerdo del 16/9/2026 con Santiago Reinaldi: además de vender, pasa a ser el
-- RESPONSABLE de las cuentas (la reunión mensual, la relación, que se queden) y
-- cobra por eso un 5% del abono todos los meses, mientras la cuenta sea suya y
-- el cliente esté al día. Es plata que se paga por ATENDER, no por haber
-- vendido: si la cuenta pasa a otra persona, el 5% pasa con ella.
--
-- Por eso hace falta un campo propio: `cerrado_por_id` dice quién vendió y no
-- cambia nunca; `responsable_id` dice quién la atiende HOY y puede cambiar.

alter table public.clients
  add column if not exists responsable_id uuid references public.users(id) on delete set null;

comment on column public.clients.responsable_id is
  'Quién atiende la cuenta hoy: cobra la cartera (5%) todos los meses. Distinto de cerrado_por_id, que es quién la vendió.';

-- Las cuentas que ya tienen cerrador comercial arrancan con él como responsable.
-- Las que cerró la dirección quedan en null a propósito: el dueño no se cobra
-- cartera a sí mismo.
update public.clients c
set responsable_id = c.cerrado_por_id
where c.responsable_id is null
  and c.cerrado_por_id is not null
  and exists (
    select 1 from public.users u
    where u.id = c.cerrado_por_id
      and (u.rol = 'comercial' or u.rol_secundario = 'comercial')
  );

-- Los porcentajes del acuerdo nuevo, para que se puedan tocar sin deploy:
--   cierre 15% el mes 1 · residual 5% los meses 2 a 4 (solo para quien cierra y
--   NO se queda con la cuenta) · cartera 5% por mes para quien la atiende.
update public.agency_settings
set rates = coalesce(rates, '{}'::jsonb) || jsonb_build_object(
  'comision_cierre', 0.15,
  'comision_residual', 0.05,
  'comision_residual_meses', 3,
  'comision_cartera', 0.05
)
where id = 1;
