-- Contexto del prospecto en la propuesta: su web, su Instagram y el rubro
-- escrito a mano cuando no entra en ninguna de las fichas.
--
-- Por qué: la propuesta se armaba con la ficha del rubro y recién después se
-- "afinaba" con IA, así que hacían falta dos o tres llamadas para llegar a algo
-- bueno — y cada iteración cuesta. Dándole el contexto ANTES (qué hace el
-- negocio, su sitio, su Instagram, lo que se dijo en la reunión), la primera
-- salida ya sirve.
alter table public.proposals
  add column if not exists sitio_web text,
  add column if not exists instagram text;

-- `rubro_texto` ya existía y guardaba el rubro de la campaña; ahora también
-- recibe lo que se escribe a mano cuando se elige "otro rubro".
comment on column public.proposals.rubro_texto is
  'Rubro en palabras: viene de la campaña, o lo escribe la persona cuando elige "otro rubro". Es lo que lee la IA.';
