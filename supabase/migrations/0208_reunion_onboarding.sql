-- El día de la reunión de onboarding (19/10/2026, pedido de Luz): el arranque
-- de 15 días se cuenta desde esa reunión y no desde el alta de la cuenta. Al
-- cargarla, los pasos que siguen abiertos se corren a la nueva fecha.
alter table public.clients add column if not exists onboarding_reunion date;
comment on column public.clients.onboarding_reunion is 'Día de la reunión de onboarding: el día 1 del arranque. null = se cuenta desde fecha_inicio.';
