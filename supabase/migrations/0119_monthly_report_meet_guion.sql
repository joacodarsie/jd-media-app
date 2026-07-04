-- Guión INTERNO del meet mensual con el cliente: puntos de conversación armados
-- con IA a partir de las métricas del mes (y la comparación con el mes anterior).
-- Distinto de ai_resultados (que es la lectura de cara al cliente).
alter table public.client_monthly_reports
  add column if not exists ai_meet_guion    text,
  add column if not exists ai_meet_guion_at timestamptz;
