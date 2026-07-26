-- Contactos rápidos: guardar también el INSTAGRAM y el SITIO del negocio.
-- Muchos contactos no tienen WhatsApp publicado, así que sin otra vía quedaban
-- inservibles. Ahora siempre tiene que quedar al menos un canal para escribirles
-- (teléfono o perfil de Instagram) y un link para abrir y mirar la cuenta antes
-- de mandar el mensaje.
alter table public.prospecting_contacts
  add column if not exists instagram text,
  add column if not exists sitio_web text;
