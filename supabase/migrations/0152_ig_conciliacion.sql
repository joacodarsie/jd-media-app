-- Conciliación Instagram ↔ calendario: memoria de lo que YA se descartó.
--
-- La conciliación cruza el feed real de Instagram (que el sync diario deja en
-- ig_snapshots.detalle.media) contra las piezas del calendario. Los cruces
-- seguros se aplican solos; los dudosos los confirma una persona. Sin esta
-- tabla, un cruce rechazado volvía a proponerse todos los días.
--
-- Dos usos:
--   * publication_id + ig_media_id → "esa pieza NO es ese posteo".
--   * publication_id nulo          → "ese posteo no es contenido nuestro"
--                                     (lo subió el cliente, es una repost, etc).
create table if not exists public.ig_conciliacion_descartes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clients(id) on delete cascade,
  publication_id uuid references public.publications(id) on delete cascade,
  ig_media_id text not null,
  descartado_por_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Un mismo par no se descarta dos veces. (publication_id nulo => índice parcial
-- aparte, porque en Postgres los nulos no chocan entre sí en un unique común.)
create unique index if not exists ig_conciliacion_descartes_par_idx
  on public.ig_conciliacion_descartes (publication_id, ig_media_id)
  where publication_id is not null;

create unique index if not exists ig_conciliacion_descartes_media_idx
  on public.ig_conciliacion_descartes (cliente_id, ig_media_id)
  where publication_id is null;

create index if not exists ig_conciliacion_descartes_cliente_idx
  on public.ig_conciliacion_descartes (cliente_id);

alter table public.ig_conciliacion_descartes enable row level security;

drop policy if exists ig_conciliacion_descartes_read on public.ig_conciliacion_descartes;
create policy ig_conciliacion_descartes_read
  on public.ig_conciliacion_descartes for select
  to authenticated using (true);

drop policy if exists ig_conciliacion_descartes_write on public.ig_conciliacion_descartes;
create policy ig_conciliacion_descartes_write
  on public.ig_conciliacion_descartes for all
  to authenticated using (true) with check (true);

-- Aura "sin testear" de la pantalla nueva.
insert into public.review_flags (ruta, label, nota)
values (
  '/contenidos/salio',
  '¿Salió de verdad? — conciliación con Instagram',
  'Compara el feed real de Instagram contra el calendario. Revisar: (1) que las piezas que marcó como publicadas hayan salido de verdad (abrir el link del posteo), (2) los cruces dudosos antes de confirmarlos, (3) los posteos que salieron sin estar en el calendario, (4) las piezas "fantasma" que figuran publicadas y en Instagram no están.'
)
on conflict do nothing;
