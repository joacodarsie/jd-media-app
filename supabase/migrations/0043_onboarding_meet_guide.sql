-- Guía de meet de onboarding personalizada por cliente.
-- A partir de la transcripción del meet comercial previo, la IA genera
-- una guía adaptada que skippea lo que ya se sabe y profundiza en gaps.

alter table public.client_onboarding
  add column if not exists meet_guide_md          text,
  add column if not exists meet_guide_source_text text,
  add column if not exists meet_guide_generated_at timestamptz,
  add column if not exists meet_guide_model        text;
