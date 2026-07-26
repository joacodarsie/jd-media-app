-- Nueva área "Coordinación de Paid Media" (Guille pasa a coordinar el área,
-- igual que se hizo con Coordinación de Diseño en la 0117). La función is_area
-- valida el campo `area` de users y positions, así que hay que sumarla acá.
create or replace function public.is_area(v text) returns boolean
language sql immutable
set search_path = public
as $$
  select v in (
    'Estrategia/Dirección','Coordinación General','Coordinación','Coordinación de Diseño',
    'Coordinación de Paid Media',
    'Paid Media','Prospecting','Comercial','Creativas',
    'Community Manager','Edición Audiovisual','Desarrollo Web','Botly','Diseño'
  );
$$;
