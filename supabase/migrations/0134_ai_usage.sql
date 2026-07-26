-- Control de gasto de IA: cada llamada a Claude deja su consumo registrado, para
-- poder responder "¿cuánto gasté en IA este mes y en qué?" y decidir con datos
-- qué modelo usar en cada función. Lo escribe el service role (bypassa RLS); lo
-- lee solo staff.
create table if not exists public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  ruta          text not null,                  -- qué función la usó (ej: prospeccion/extract)
  modelo        text not null,
  user_id       uuid references public.users(id) on delete set null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0, -- tokens servidos desde caché (más baratos)
  costo_usd     numeric(12, 6) not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);
create index if not exists ai_usage_ruta_idx on public.ai_usage (ruta, created_at desc);

alter table public.ai_usage enable row level security;

-- Solo staff (admin/coordinación) puede mirarlo. La escritura va por service role.
drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage
  for select to authenticated using (public.jd_is_staff());

insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/finanzas/ia', 'Gasto de IA',
   'Nueva pantalla con el consumo de IA: total del mes, desglose por función y por persona, y últimas llamadas. Se llena sola a medida que se usa la IA (empieza vacía). Entrá después de usar el buscador de leads o generar mensajes y verificá que aparezca el gasto.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
