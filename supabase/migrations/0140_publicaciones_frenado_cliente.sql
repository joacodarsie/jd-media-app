-- Puntualidad justa: separar "nos atrasamos nosotros" de "lo frenó el cliente".
--
-- Buena parte de las piezas que se pasan de fecha no son culpa del equipo: el
-- cliente no mandó el material, pidió esperar, no aprobó, o frenó la cuenta unas
-- semanas. Si el semáforo mete todo en la misma bolsa, le echa la culpa al
-- equipo, deja de ser creíble y en dos semanas nadie lo mira.
--
-- Con esta marca, la pieza sale del cálculo de atraso del equipo y pasa a una
-- lista aparte: "esperando al cliente", que es un reclamo comercial, no de
-- producción.
alter table public.publications
  add column if not exists frenado_cliente boolean not null default false,
  add column if not exists frenado_nota    text,
  add column if not exists frenado_at      timestamptz;

create index if not exists publications_frenado_idx
  on public.publications (cliente_id)
  where frenado_cliente;

-- Aura "sin testear".
insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/contenidos', 'Frenado por el cliente',
   'Abrí una publicación atrasada → botón "Lo frenó el cliente" con una nota (ej: "no mandó las fotos"). Esa pieza tiene que salir del conteo de atraso del equipo y pasar a "esperando al cliente", tanto en el aviso de Contenidos como en el semáforo del Director. Probá también sacarle la marca.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
