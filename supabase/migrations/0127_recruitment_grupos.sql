-- Grupos del pool de talento.
--
-- Hasta ahora un candidato pertenecía a UNA búsqueda (search_id). Para armar
-- shortlists con nombre ("CM finalistas", "Editores a entrevistar") SIN sacar al
-- candidato del pool, agregamos etiquetas de grupo: un candidato puede estar en
-- varios grupos. Los grupos se crean marcando gente desde el pool.

alter table public.recruitment_candidates
  add column if not exists grupos text[] not null default '{}';

create index if not exists recruitment_candidates_grupos_idx
  on public.recruitment_candidates using gin (grupos);

-- Aura "sin testear": el dueño lo revisa y aprueba.
insert into public.review_flags (ruta, label, nota)
select '/reclutamiento',
       'Grupos del pool: armar shortlists marcando candidatos',
       'En cada candidato del pool podés agregarlo a un grupo con nombre (ej "CM finalistas") sin sacarlo del pool. Arriba tenés un filtro por grupo. Probar: crear un grupo nuevo desde una fila, sumar 2-3 candidatos, filtrar por ese grupo y sacar a uno.'
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = '/reclutamiento'
    and rf.label = 'Grupos del pool: armar shortlists marcando candidatos'
);
