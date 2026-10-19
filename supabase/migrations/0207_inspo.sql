-- Banco de inspiración por cuenta (19/10/2026). Pedido del dueño: «que la CM
-- tenga inspo de contenido relacionado a cada cuenta, con datos reales de
-- Instagram: cómo comunican las cuentas de referencia, qué formatos funcionan
-- y las tendencias». Fuentes: cuentas de referencia (business discovery) y
-- hashtags del rubro (si Meta lo permite). Se lee y escribe con service role.
create table if not exists public.inspo_fuentes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clients(id) on delete cascade,
  tipo text not null check (tipo in ('cuenta', 'hashtag')),
  valor text not null,
  ultimo_fetch timestamptz,
  error text,
  creado_por uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (cliente_id, tipo, valor)
);

create table if not exists public.inspo_piezas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clients(id) on delete cascade,
  fuente_id uuid references public.inspo_fuentes(id) on delete cascade,
  media_id text not null,
  cuenta text,
  seguidores integer,
  permalink text,
  caption text,
  media_type text,
  producto text,
  publicado_at timestamptz,
  likes integer,
  comentarios integer,
  imagen text,
  -- Cuántas veces rindió más que lo normal de esa cuenta (o del hashtag).
  rendimiento numeric,
  created_at timestamptz not null default now(),
  unique (cliente_id, media_id)
);

create index if not exists inspo_piezas_cliente_idx on public.inspo_piezas (cliente_id, publicado_at desc);

alter table public.inspo_fuentes enable row level security;
alter table public.inspo_piezas enable row level security;
