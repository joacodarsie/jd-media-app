-- Reclutamiento: "Pool de talento". En vez de puntuar cada CV contra un puesto,
-- el pool analiza todos los CVs una vez y la IA puntúa cada uno contra TODAS las
-- áreas (CM, diseño, edición, paid media, desarrollo, comercial), guarda el
-- puntaje por área y elige el mejor rol. Después se filtra por rol.

-- Puntajes por área: { "cm": 70, "diseno": 90, "edicion": 40, ... } (0..100).
alter table public.recruitment_candidates
  add column if not exists area_scores jsonb not null default '{}'::jsonb;

-- Marca la búsqueda "pool" (singleton) para distinguirla de las búsquedas por
-- puesto y poder ocultarla del listado normal.
alter table public.recruitment_searches
  add column if not exists es_pool boolean not null default false;
