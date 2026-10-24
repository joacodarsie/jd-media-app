-- Área Creativa (pedido de Santi y del dueño, 23/10/2026).
--
-- 1) Documentos de campaña: el director creativo sube por cliente la plataforma
--    de campaña, la estrategia de redes y el documento técnico. Cada uno vale
--    por un tiempo (inicio + duración); la plataforma calcula el vencimiento y
--    avisa 7 días antes para replantear la estrategia. Van en `documents`, así
--    JDmedIA los usa como referencia al armar los calendarios (usar_en_ia).
-- 2) Onboarding creativo: lo que el director creativo define al arrancar una
--    cuenta (identidad, tono, importancia de cada medio y urgencia).

alter type public.document_category add value if not exists 'campana';

alter table public.documents
  add column if not exists campana_inicio date,
  add column if not exists campana_dias integer,
  add column if not exists entregable text;

do $$ begin
  alter table public.documents
    add constraint documents_entregable_check
    check (entregable is null or entregable in ('plataforma_campana', 'estrategia_redes', 'documento_tecnico', 'otro'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.documents
    add constraint documents_campana_dias_check check (campana_dias is null or campana_dias between 1 and 730);
exception when duplicate_object then null; end $$;

comment on column public.documents.campana_inicio is 'Documento de campaña: desde cuándo rige.';
comment on column public.documents.campana_dias is 'Documento de campaña: cuántos días dura. Vence = inicio + días.';
comment on column public.documents.entregable is 'plataforma_campana | estrategia_redes | documento_tecnico | otro.';

alter table public.client_onboarding
  add column if not exists dc_identidad text,
  add column if not exists dc_tono text,
  -- { instagram: 'alta' | 'media' | 'baja' | 'no', tiktok: ..., ... }
  add column if not exists dc_medios jsonb not null default '{}'::jsonb,
  -- urgente (necesita vender ya) | crecer (sumar clientes de a poco) | marca (construir a largo plazo)
  add column if not exists dc_urgencia text,
  add column if not exists dc_objetivo text,
  add column if not exists dc_actualizado_at timestamptz,
  add column if not exists dc_actualizado_por uuid references public.users(id) on delete set null;

do $$ begin
  alter table public.client_onboarding
    add constraint client_onboarding_dc_urgencia_check check (dc_urgencia is null or dc_urgencia in ('urgente', 'crecer', 'marca'));
exception when duplicate_object then null; end $$;
