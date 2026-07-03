-- Onboarding · etapa de Community Manager (arranque de la cuenta desde el lado
-- del CM, distinto de los pasos de la coordinación). El/la CM confirma que puede
-- operar la cuenta: accesos, rediseño de perfiles y la vinculación IG ↔ Facebook.
alter table public.client_onboarding
  add column if not exists cm_accesos_at      timestamptz,  -- acceso a TODAS las cuentas del cliente
  add column if not exists cm_perfiles_at     timestamptz,  -- rediseño de perfiles y biografías de todas las cuentas
  add column if not exists cm_vinculacion_at  timestamptz;  -- IG correctamente vinculado a la página de Facebook
