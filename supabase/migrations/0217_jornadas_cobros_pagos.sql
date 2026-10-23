-- Jornadas de producción: el registro completo (pedido del dueño y de Luz, 23/10/2026).
--
-- Las jornadas se agendaban en la Agenda pero el dueño se colgaba con los cobros
-- y los pagos: no quedaba registrado cuánto se cobró, a quién ya se le pagó ni
-- los viáticos de cada uno. Ahora cada jornada guarda:
--
--   · hora_inicio          a qué hora arrancó (la duración ya estaba: horas).
--   · viaticos_detalle     los viáticos de CADA persona: { user_id: monto }.
--                          `viaticos` sigue siendo el total (la suma).
--   · cobrado / cobrado_at cuánto se le cobró al cliente y cuándo.
--   · pagos                a quién ya se le pagó: { user_id: { monto, fecha } }.
--   · confirmada_at        Luz confirma los datos reales después de la jornada
--                          (duración, viáticos); recién ahí le avisa al dueño.

alter table public.production_sessions
  add column if not exists hora_inicio text,
  add column if not exists viaticos_detalle jsonb not null default '{}'::jsonb,
  add column if not exists cobrado numeric(14,2),
  add column if not exists cobrado_at date,
  add column if not exists pagos jsonb not null default '{}'::jsonb,
  add column if not exists confirmada_at timestamptz,
  add column if not exists confirmada_por_id uuid references public.users(id) on delete set null;

comment on column public.production_sessions.hora_inicio is 'HH:MM en que arrancó la jornada.';
comment on column public.production_sessions.viaticos_detalle is 'Viáticos de cada persona: { user_id: monto }. viaticos = la suma.';
comment on column public.production_sessions.cobrado is 'Lo que se le cobró al cliente (precio + viáticos si los paga él).';
comment on column public.production_sessions.pagos is 'A quién ya se le pagó su parte: { user_id: { monto, fecha } }. Lo pagado acá no vuelve a sumarse al sueldo.';
comment on column public.production_sessions.confirmada_at is 'Luz confirmó los datos reales (duración, viáticos) después de la jornada.';

-- La hora de las jornadas que vinieron de la Agenda.
update public.production_sessions ps
set hora_inicio = to_char(m.starts_at at time zone 'America/Argentina/Cordoba', 'HH24:MI')
from public.internal_meetings m
where m.production_session_id = ps.id and ps.hora_inicio is null;
