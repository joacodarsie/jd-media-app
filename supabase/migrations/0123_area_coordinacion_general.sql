-- Sumar "Coordinación General" a las áreas válidas (is_area se usa como CHECK en
-- users.area y tasks.area). Es el área de Leo, mano derecha de la dirección: rol
-- admin (acceso total) pero en el organigrama figura como Coordinación General,
-- por encima de las coordinaciones de Redes (Luz) y Diseño (Brisa).
create or replace function public.is_area(v text) returns boolean
language sql immutable
set search_path = public
as $$
  select v in (
    'Estrategia/Dirección','Coordinación General','Coordinación','Coordinación de Diseño',
    'Paid Media','Prospecting','Comercial','Creativas',
    'Community Manager','Edición Audiovisual','Desarrollo Web','Botly','Diseño'
  );
$$;

-- Leo pasa a Coordinación General (su rol admin ya está seteado por datos).
update public.users
   set area = 'Coordinación General'
 where lower(nombre) like '%leonardo%martinez%';
