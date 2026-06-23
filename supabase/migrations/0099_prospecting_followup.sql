-- Prospección: mensaje de SEGUIMIENTO (follow-up). El primer mensaje rara vez
-- cierra; la conversión vive en el segundo/tercer toque. Guardamos un follow-up
-- generado por IA aparte del mensaje inicial, para que el comercial lo tenga
-- listo cuando el lead no respondió. También dejamos asentado cuándo se contactó
-- por primera vez, para priorizar a quién hacerle seguimiento.
alter table public.prospecting_leads
  add column if not exists seguimiento  text,
  add column if not exists contactado_at timestamptz;

-- Cuando un lead pasa a "contactado" por primera vez, sellar contactado_at.
-- (Lo setea la app, pero dejamos la columna lista.)
