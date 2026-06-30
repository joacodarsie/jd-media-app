-- Onboarding de Diseño Gráfico: el arranque visual de una cuenta nueva de
-- gestión de redes. Lo hace el diseñador/a y lo aprueba la Coordinación de
-- Diseño antes de mandarlo al grupo. Pasos:
--  - manual de marca (Canva), kit de marca, proyecto Canva del cliente,
--    plantillas de historias, y la aprobación de la coordinación de diseño.
alter table public.client_onboarding
  add column if not exists dg_manual_marca_at         timestamptz,
  add column if not exists dg_kit_marca_at            timestamptz,
  add column if not exists dg_proyecto_canva_at       timestamptz,
  add column if not exists dg_plantillas_historias_at timestamptz,
  add column if not exists dg_aprobado_at             timestamptz;
