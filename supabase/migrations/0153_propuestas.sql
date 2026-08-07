-- Propuestas comerciales: el documento que se manda cuando un prospecto
-- responde "mandame una propuesta".
--
-- Es un LINK, no un PDF adjunto: se abre al toque en el celular, tiene botón de
-- WhatsApp y —lo importante— sabemos cuándo la abrieron. Un PDF adjunto no dice
-- nada, y hoy tenemos 116 contactados sin ninguna señal de quién sigue vivo.
-- La página igual se puede guardar como PDF desde el mismo documento.
--
-- El contenido NO se guarda acá: los servicios y los packs salen de `services` y
-- `agency_packs` (que se sincronizan solos con jdmedia.com.ar), así que una
-- propuesta vieja siempre muestra el precio de hoy. Acá va lo propio de cada
-- prospecto: a quién, de qué rubro y el bloque que escribió la IA si se usó.
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  -- Va en la URL pública. Sin secreto adentro: la propuesta no tiene datos
  -- sensibles, pero es largo para que no se adivine el de otro.
  token text not null unique,
  empresa text not null,
  contacto_nombre text,
  -- Ficha de rubro elegida (ver lib/propuestas/rubros.ts) + el texto original.
  rubro_slug text,
  rubro_texto text,
  pack_sugerido text,
  servicios text[],
  -- Lo que dijo el prospecto (se pega a mano o sale de la captura que se sube).
  notas text,
  -- Bloque personalizado que escribió la IA: {titular, diagnostico, puntos[], generado_at}
  ia jsonb,
  contacto_id uuid references public.prospecting_contacts(id) on delete set null,
  campaign_id uuid references public.prospecting_campaigns(id) on delete set null,
  creada_por_id uuid references public.users(id) on delete set null,
  aperturas integer not null default 0,
  primera_apertura_at timestamptz,
  ultima_apertura_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_token_idx on public.proposals (token);
create index if not exists proposals_creada_por_idx on public.proposals (creada_por_id);
create index if not exists proposals_contacto_idx on public.proposals (contacto_id);

alter table public.proposals enable row level security;

-- La página pública NO usa estas policies: lee con service role y valida el
-- token. Estas son para el equipo dentro de la app.
drop policy if exists proposals_read on public.proposals;
create policy proposals_read
  on public.proposals for select
  to authenticated using (true);

drop policy if exists proposals_write on public.proposals;
create policy proposals_write
  on public.proposals for all
  to authenticated using (true) with check (true);

insert into public.review_flags (ruta, label, nota)
values (
  '/prospeccion/propuestas',
  'Propuestas comerciales',
  'Se crea una propuesta desde Contactos (botón 📄) o desde acá. Revisar: (1) que el link abra bien en el celular, (2) que los precios coincidan con jdmedia.com.ar, (3) el botón "Afinar con IA" pegando lo que dijo el prospecto o subiendo la captura del chat, (4) que el contador de aperturas suba cuando alguien la abre.'
)
on conflict do nothing;
