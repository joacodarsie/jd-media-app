-- Columna para guardar el resumen/extracto que la IA genera al subir un PDF cliente.
-- Así el suggester no necesita re-mandar el PDF entero cada vez (más rápido, más barato).
alter table public.documents
  add column if not exists texto_extraido text,
  add column if not exists texto_extraido_at timestamptz;
