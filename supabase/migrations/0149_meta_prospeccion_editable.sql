-- Meta diaria de prospección editable desde la app.
--
-- Antes vivía hardcodeada por email en src/lib/prospecting/actividad.ts, con
-- el argumento de que se toca cada varios meses. En la práctica el equipo
-- cambió y había que pedir un deploy para mover un número: ahora se edita
-- desde "¿Quién está escribiendo?".
--
-- null = usar la meta por defecto (10). 0 = a esa persona no se le exige nada
-- (no suma al total del equipo ni aparece como colgada).

alter table public.users
  add column if not exists meta_prospeccion smallint
  check (meta_prospeccion is null or (meta_prospeccion >= 0 and meta_prospeccion <= 500));

comment on column public.users.meta_prospeccion is
  'Mensajes en frío por día que se le piden a esta persona. null = default (10), 0 = no se le exige.';

-- Semilla con los valores que estaban en código, para que la tabla siga
-- mostrando lo mismo el día que se aplique.
update public.users set meta_prospeccion = 40
  where lower(email) in ('leo@jdmedia.com', 'guille@jdmedia.com')
    and meta_prospeccion is null;

update public.users set meta_prospeccion = 10
  where lower(email) in ('gonzalo@jdmedia.com', 'joaquin@jdmedia.com')
    and meta_prospeccion is null;

insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/prospeccion/actividad', 'Metas de prospección editables',
   'En "¿Quién está escribiendo?" (Comercial → Prospección → ¿Quién está escribiendo?), al lado del nombre de cada persona el admin ahora puede editar la meta diaria: se toca el número, se escribe y se guarda al salir del campo o con Enter. La meta del equipo de arriba es la suma y se actualiza sola. Poner 0 significa que a esa persona no se le exige nada (no suma al total ni figura en "hace 3 días que no escriben"). Probá cambiar una meta y recargar para ver que quedó.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
