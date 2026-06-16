-- Lectura con IA de los resultados del mes (interpreta seguidores/alcance/
-- interacciones de IG + inversión/conversiones de paid media). Se genera
-- on-demand desde el reporte y se muestra también en el portal del cliente.

alter table public.client_monthly_reports
  add column if not exists ai_resultados    text,
  add column if not exists ai_resultados_at timestamptz;
