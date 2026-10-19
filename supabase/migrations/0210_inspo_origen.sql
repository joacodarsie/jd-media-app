-- De dónde salió cada referencia de inspo (19/10/2026): la cargó el equipo, la
-- nombró el cliente (en su reunión) o la propuso la IA (verificada contra
-- Instagram). Lo manual y lo del cliente tiene prioridad.
alter table public.inspo_fuentes add column if not exists origen text not null default 'manual'
  check (origen in ('manual', 'cliente', 'ia'));
