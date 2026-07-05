-- Cláusulas editables de la carta acuerdo (solo admin). jsonb con overrides por
-- clave de cláusula (ej. {"confidencialidad": "texto...", "rescision": "..."}).
-- null / clave ausente = se usa el texto por defecto hardcodeado. No afecta las
-- cláusulas dinámicas (servicios, honorarios, duración): esas se calculan.
alter table public.agency_settings
  add column if not exists contract_clauses jsonb;
