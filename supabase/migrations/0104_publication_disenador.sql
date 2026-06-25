-- Diseñador/a por publicación: en un reel, además del editor (audiovisual_id),
-- quién hace la PORTADA. Por defecto es el/la diseñador/a de la cuenta
-- (clients.disenador_id), pero si una portada puntual la hace otra persona se
-- carga acá y es quien cobra esa portada en la nómina por contenido real.
--
-- (Para post/carrusel el "responsable" sigue siendo audiovisual_id, que en esos
-- tipos representa al diseñador de la pieza.)
alter table public.publications
  add column if not exists disenador_id uuid references public.users(id) on delete set null;

create index if not exists idx_publications_disenador on public.publications(disenador_id);
