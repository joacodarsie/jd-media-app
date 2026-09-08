-- Estado del pago de sueldos: cuánto se pagó de verdad y qué quedó pendiente.
--
-- Por qué: el pago era binario (registrado / pagado) y en la práctica no lo es.
-- En la planilla que el dueño lleva a mano, agosto de Luz figura como
-- "$879.300 total · $679.300 pagado · $200.000 falta". Eso no tenía dónde
-- anotarse en la app, así que la planilla seguía siendo la fuente de verdad y
-- la app quedaba desactualizada.
--
-- `monto_pagado` cubre el caso completo: 0 = registrado sin pagar, menos que el
-- monto = pagó una parte, igual o más = saldado.
alter table public.team_payments
  add column if not exists monto_pagado numeric not null default 0;

comment on column public.team_payments.monto_pagado is
  'Lo efectivamente transferido. Menor al monto = quedó un saldo pendiente.';

insert into public.review_flags (ruta, label, nota)
values (
  '/coordinacion/sueldos',
  'Sueldos: alias a la vista y pagos parciales',
  'Cada persona muestra su alias con botón de copiar. "Registrar pago" ya NO copia el mensaje (el mensaje quedó en un botón aparte). Y se puede anotar un pago parcial: revisar que al cargar menos del total quede como "pagó una parte" con el saldo, y que al completarlo pase a pagado.'
)
on conflict do nothing;
