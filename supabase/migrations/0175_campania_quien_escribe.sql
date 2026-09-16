-- Quién escribe los mensajes de la campaña.
--
-- Hasta ahora los mensajes se firmaban solos: los de la campaña con el nombre
-- de quien apretaba "generar", y los de cada lead SIEMPRE con el representante
-- de la agencia (Joaquín). Si el que prospecta es Matías, el mensaje decía
-- "soy Joaquín de JD Media" y el prospecto se encontraba con otra persona.
--
-- Ahora es un dato de la campaña, que se elige al crearla y se puede cambiar
-- después: una campaña la trabaja una persona.

alter table public.prospecting_campaigns
  add column if not exists escribe_id uuid references public.users(id) on delete set null;

comment on column public.prospecting_campaigns.escribe_id is
  'Quién manda los mensajes de esta campaña: con su nombre se firman. Null = quien los genera.';

-- Las campañas que ya existen las escribe quien las creó.
update public.prospecting_campaigns
set escribe_id = created_by
where escribe_id is null and created_by is not null;
