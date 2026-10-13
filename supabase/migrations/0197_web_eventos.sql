-- El embudo de jdmedia.com.ar, medido por la plataforma (13/10/2026).
--
-- La web avisa cada visita (una por sesión), cada clic a WhatsApp, cada clic a
-- "dejanos tu reseña" y de dónde vino la gente (Instagram, Google, directo…).
-- Solo conteos: nada que identifique a una persona. Lo lee la sección
-- Dirección. Solo se escribe desde la API pública (service role).
create table if not exists public.web_eventos (
  id bigserial primary key,
  tipo text not null check (tipo in ('visita', 'whatsapp', 'resena', 'recurso')),
  pagina text,
  fuente text,
  created_at timestamptz not null default now()
);
create index if not exists idx_web_eventos_fecha on public.web_eventos (created_at desc);
alter table public.web_eventos enable row level security;
-- Sin políticas: solo el service role (API y Dirección) la lee y la escribe.
