-- Prospección: marcar si el Instagram del lead fue verificado con búsqueda web.
--  - null  = todavía no se verificó
--  - true  = se confirmó que el perfil existe y es de la empresa
--  - false = se verificó y NO se encontró un perfil real (handle dudoso/muerto)
-- El descubrimiento ahora verifica/corrige el handle antes de guardar el lead, y
-- hay un botón "Verificar IG" por lead para los ya cargados.
alter table public.prospecting_leads
  add column if not exists instagram_verificado boolean;
