-- Diagnóstico gratis de Instagram en la web (17/10/2026).
-- Cada consulta queda guardada: sirve de caché (la misma cuenta no se vuelve a
-- pedir a Instagram en 24 h), de límite por persona y para que Comercial vea
-- quién se interesó. Solo la usa el servidor (service role): sin políticas.
create table if not exists public.diagnosticos_web (
  id         bigserial primary key,
  usuario    text not null,
  ip_hash    text,
  ok         boolean not null default false,
  puntaje    integer,
  resultado  jsonb,
  created_at timestamptz not null default now()
);

create index if not exists diagnosticos_web_usuario_idx on public.diagnosticos_web (usuario, created_at desc);
create index if not exists diagnosticos_web_ip_idx on public.diagnosticos_web (ip_hash, created_at desc);

alter table public.diagnosticos_web enable row level security;

comment on table public.diagnosticos_web is
  'Diagnósticos de Instagram pedidos desde jdmedia.com.ar. Caché 24 h, límite por IP y registro comercial.';
