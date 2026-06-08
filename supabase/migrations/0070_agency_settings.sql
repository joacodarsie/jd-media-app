-- Panel de Coordinación: parámetros clave de la agencia (packs + tarifas por
-- rol) que solo el admin controla. Tabla singleton (una sola fila).
-- Acceso: sin policies → solo service_role. La app entra con el admin client
-- después de validar requireRole(['admin']).

create table if not exists public.agency_settings (
  id          smallint primary key default 1,
  packs       jsonb not null,
  rates       jsonb not null,
  updated_at  timestamptz not null default now(),
  constraint agency_settings_singleton check (id = 1)
);

alter table public.agency_settings enable row level security;
-- (intencionalmente sin policies: el acceso es solo vía service_role)

insert into public.agency_settings (id, packs, rates)
values (
  1,
  '[
    {"id":"Presencia","precio":350000,"reels":4,"posts":4,"stories":8},
    {"id":"Crecimiento","precio":500000,"reels":8,"posts":8,"stories":12},
    {"id":"Escala","precio":700000,"reels":12,"posts":12,"stories":20}
  ]'::jsonb,
  '{
    "diseno_pieza":10000,
    "edicion_reel":17900,
    "manual_marca":50000,
    "cm":{"Presencia":50000,"Crecimiento":70000,"Escala":100000},
    "media_buyer":{"Presencia":50000,"Crecimiento":70000,"Escala":100000}
  }'::jsonb
)
on conflict (id) do nothing;
