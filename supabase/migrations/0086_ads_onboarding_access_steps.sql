-- Onboarding de publicidad: pasos nuevos para el modelo de accesos recomendado.
-- El cliente es DUEÑO de sus activos y nos da acceso como SOCIO (partner) con
-- administración total; después asignamos cada activo al System User "jdmedia"
-- para que la app traiga pauta + resultados de Instagram automáticamente.

alter table public.client_ads_onboarding
  add column if not exists pagina_fb_at      timestamptz,  -- el cliente tiene (o le creamos) su página de FB
  add column if not exists socio_business_at timestamptz,  -- nos agregó como socio del Business con admin total
  add column if not exists su_adaccount_at   timestamptz,  -- cuenta publicitaria asignada al system user
  add column if not exists su_pagina_at      timestamptz,  -- página de FB asignada al system user
  add column if not exists su_ig_at          timestamptz;  -- cuenta de Instagram asignada al system user
