-- La carpeta de Drive de cada ticket.
--
-- Pedido del 13/9/2026: "una vez que se van cargando los contenidos, deben
-- cargarse en una carpeta en drive con los números de ticket correspondientes
-- como carpeta, y el título correspondiente — está bueno que se genere
-- automáticamente".
--
-- Se guarda el link y no solo el id: es lo que se le pasa al diseñador, y así
-- la pantalla no tiene que llamar a Drive para armarlo.
alter table public.tasks
  add column if not exists drive_url text;

insert into public.review_flags (ruta, label, nota)
values (
  '/tareas',
  'Carpeta de Drive por ticket',
  'Cuando le agregás la primera subtarea a un ticket de una cuenta, se crea sola la carpeta en el Drive del cliente: "Tickets › JD-14 - Destacadas". El botón de arriba del ticket la abre, y si todavía no existe la crea. Revisar: (1) que la carpeta aparezca en el Drive del cliente correcto, (2) que el nombre lleve el número de ticket, (3) que tocar el botón dos veces no cree carpetas repetidas, (4) que un ticket sin cliente no muestre el botón.'
)
on conflict do nothing;
