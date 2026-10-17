-- Crecimiento de cada cuenta: «fotos» automáticas del Instagram (17/10/2026).
-- Pedido del dueño: mostrar el antes y el después sin sacar capturas a mano.
-- La plataforma toma una foto al arrancar (o la reconstruye con las
-- publicaciones anteriores a la fecha de inicio) y otra cada mes: métricas,
-- puntaje y las últimas 9 publicaciones guardadas como imagen.
create table if not exists public.cuenta_fotos (
  id             bigserial primary key,
  client_id      uuid not null references public.clients(id) on delete cascade,
  -- 'inicio' (cómo estaba al arrancar) · 'mensual'
  tipo           text not null check (tipo in ('inicio', 'mensual')),
  fecha          date not null,
  -- false si el inicio se reconstruyó después con las publicaciones viejas
  -- (no se conoce el perfil ni los seguidores de ese día).
  real           boolean not null default true,
  usuario        text,
  seguidores     integer,
  publicaciones  integer,
  posts_mes      integer,
  reels          integer,         -- de las últimas 12
  interaccion    numeric,         -- promedio de me gusta + comentarios por publicación
  puntaje        integer,
  pilares        jsonb,
  grilla         jsonb not null default '[]'::jsonb, -- [{img, permalink, tipo, fecha}]
  created_at     timestamptz not null default now(),
  unique (client_id, tipo, fecha)
);

create index if not exists cuenta_fotos_cliente_idx on public.cuenta_fotos (client_id, fecha desc);

alter table public.cuenta_fotos enable row level security;

-- La lee el equipo (la ficha la arma el servidor con service role igual).
drop policy if exists cuenta_fotos_staff_select on public.cuenta_fotos;
create policy cuenta_fotos_staff_select on public.cuenta_fotos
  for select to authenticated using (true);

-- Las imágenes son de publicaciones públicas de Instagram: bucket público,
-- así se pueden mostrar en el portal y en jdmedia.com.ar.
insert into storage.buckets (id, name, public)
values ('cuenta-fotos', 'cuenta-fotos', true)
on conflict (id) do nothing;
