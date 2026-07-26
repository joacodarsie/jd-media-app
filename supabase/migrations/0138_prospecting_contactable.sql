-- Contactos: distinguir "NO se pudo contactar" (el dato estaba mal: teléfono
-- inexistente, IG que no existe, no atiende) de "no le interesó" (descartado).
-- Son dos cosas distintas y antes se mezclaban en el mismo estado, lo que
-- ensuciaba las métricas: un dato mal cargado no es un lead perdido.
--
-- null  = todavía no se intentó
-- true  = se pudo contactar (el dato sirve)
-- false = no se pudo (dato equivocado / no existe)
alter table public.prospecting_contacts
  add column if not exists contactable boolean;
