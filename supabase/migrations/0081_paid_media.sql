-- Paid Media: conexión con Meta Ads + métricas diarias + análisis IA.
-- Fase 1 (read-only): traemos métricas de la cuenta publicitaria de cada cliente,
-- las guardamos como snapshot diario y la IA genera un análisis con sugerencias.
-- El reporte mensual de redes integra esta info. (Fase 2: aplicar cambios auto.)

-- 1) ID de la cuenta publicitaria de Meta por cliente (en el onboarding de ads).
alter table public.client_ads_onboarding
  add column if not exists meta_ad_account_id text;  -- 'act_123...' o el numérico

comment on column public.client_ads_onboarding.meta_ad_account_id is
  'ID de la cuenta publicitaria de Meta (act_XXXX) para traer métricas vía Marketing API.';

-- 2) Snapshot diario de métricas por cliente.
create table if not exists public.paid_media_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references public.clients(id) on delete cascade,
  fecha               date not null,                 -- día de las métricas
  spend               numeric(14,2) not null default 0,
  impressions         bigint not null default 0,
  reach               bigint not null default 0,
  clicks              bigint not null default 0,
  ctr                 numeric(8,4),
  cpc                 numeric(14,4),
  cpm                 numeric(14,4),
  conversions         numeric(14,2) not null default 0,
  cost_per_conversion numeric(14,2),
  moneda              text not null default 'ARS',
  detalle             jsonb,                          -- breakdown por campaña / actions
  created_at          timestamptz not null default now(),
  unique (cliente_id, fecha)
);
create index if not exists idx_pms_cliente_fecha on public.paid_media_snapshots(cliente_id, fecha desc);

-- 3) Análisis IA diario (resumen + sugerencias de mejora).
create table if not exists public.paid_media_analysis (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clients(id) on delete cascade,
  fecha         date not null,
  resumen       text,
  sugerencias   jsonb,    -- [{ accion, motivo, prioridad, campana }]
  metricas      jsonb,    -- métricas clave que vio la IA
  created_at    timestamptz not null default now(),
  unique (cliente_id, fecha)
);
create index if not exists idx_pma_cliente_fecha on public.paid_media_analysis(cliente_id, fecha desc);

-- Acceso: vía service_role en el server (tras requireRole admin/coordinador/paid_media).
-- Sin policies públicas → RLS bloquea el acceso directo de clientes.
alter table public.paid_media_snapshots enable row level security;
alter table public.paid_media_analysis enable row level security;
