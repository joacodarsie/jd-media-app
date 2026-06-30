-- Sumar "Coordinación de Diseño" a las áreas válidas (la función is_area se usa
-- como CHECK en users.area y tasks.area). Bri pasa a tener esta área como
-- principal (coordina el servicio de diseño) y "Diseño" como secundaria.
create or replace function public.is_area(v text) returns boolean
language sql immutable
set search_path = public
as $$
  select v in (
    'Estrategia/Dirección','Coordinación','Coordinación de Diseño',
    'Paid Media','Prospecting','Comercial','Creativas',
    'Community Manager','Edición Audiovisual','Desarrollo Web','Botly','Diseño'
  );
$$;
