-- Jornadas: cuando alguien va sola/o (30/10/2026, pedido de Luz), puede cobrar
-- también la parte del acompañante: 80% del trabajo para la persona y 20% para
-- la agencia. Por defecto sigue el reparto de siempre (50% y la agencia el resto).
alter table public.production_sessions
  add column if not exists cobra_todo boolean not null default false;
