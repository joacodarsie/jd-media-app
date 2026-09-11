-- Dos situaciones que hoy se escondían adentro de "perdido".
--
-- 1) EN PAUSA: el cliente frenó pero no se fue — temporada baja, se tomó un mes,
--    está esperando plata. Marcarlo "perdido" es mentirle al historial y además
--    dispara la lectura equivocada ("se nos fue otro"). Como "perdido", tampoco
--    cuenta en Finanzas ni en Sueldos mientras está frenado.
--
-- 2) PARA RECUPERAR: de los que SÍ se fueron, algunos tienen chance real de
--    volver y otros no. Sin distinguirlos, la lista de perdidos es un cementerio
--    de 24 cuentas que nadie vuelve a mirar. Es una marca, no un estado: la
--    cuenta sigue perdida, solo queda señalada para ir a buscarla.
--
-- Por qué una marca y no un estado más: "para recuperar" es ortogonal. Puede
-- convivir con perdido hoy y, si alguna vez hace falta, con en_pausa. Meterlo en
-- el enum obligaría a elegir entre "perdido" y "recuperable", que no es la
-- pregunta.

alter type public.client_status add value if not exists 'en_pausa';

alter table public.clients
  add column if not exists para_recuperar boolean not null default false;

comment on column public.clients.para_recuperar is
  'Cuenta dada de baja que vale la pena ir a buscar. No cambia el estado ni afecta finanzas.';

-- La lista de "para recuperar" se mira entera y es chica: alcanza un índice
-- parcial sobre las marcadas.
create index if not exists clients_para_recuperar_idx
  on public.clients (para_recuperar)
  where para_recuperar;
