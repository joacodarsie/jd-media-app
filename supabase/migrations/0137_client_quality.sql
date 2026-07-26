-- Calidad del servicio (etapa 2): las dos señales que faltaban y que solo puede
-- dar el vínculo con el cliente, no los números de la app.
--
-- 1) client_satisfaction: la encuesta de fin de mes. El cliente entra con el
--    MISMO token del portal (no hay que mandarle otro link), puntúa del 1 al 5 y
--    deja qué valora y qué mejoraría. Una respuesta por cliente y período.
-- 2) client_meetings: registro de la reunión mensual de seguimiento. Sirve para
--    que no se pase de largo y para saber de primera mano cómo viene la cuenta.

create table if not exists public.client_satisfaction (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clients(id) on delete cascade,
  periodo      text not null,                    -- 'YYYY-MM'
  puntaje      smallint not null check (puntaje between 1 and 5),
  que_valoran  text,                             -- qué le gustó / qué valora
  que_mejorar  text,                             -- qué mejoraría (lo más útil)
  created_at   timestamptz not null default now()
);

-- Una respuesta por cliente y mes (si vuelve a entrar, se actualiza).
create unique index if not exists client_satisfaction_cliente_periodo_uniq
  on public.client_satisfaction (cliente_id, periodo);
create index if not exists client_satisfaction_periodo_idx
  on public.client_satisfaction (periodo desc);

create table if not exists public.client_meetings (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clients(id) on delete cascade,
  periodo        text not null,                  -- 'YYYY-MM'
  fecha          date not null default current_date,
  notas          text,                           -- qué salió de la reunión
  registrado_por uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- Una reunión registrada por cliente y mes.
create unique index if not exists client_meetings_cliente_periodo_uniq
  on public.client_meetings (cliente_id, periodo);
create index if not exists client_meetings_cliente_idx
  on public.client_meetings (cliente_id, periodo desc);

alter table public.client_satisfaction enable row level security;
alter table public.client_meetings enable row level security;

-- Las respuestas del cliente entran por la página pública (service role, que
-- bypassa RLS). Desde la app las lee/edita el equipo interno.
drop policy if exists client_satisfaction_read on public.client_satisfaction;
create policy client_satisfaction_read on public.client_satisfaction
  for select to authenticated using (true);

drop policy if exists client_meetings_all on public.client_meetings;
create policy client_meetings_all on public.client_meetings
  for all to authenticated
  using (true)
  with check (true);

insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/clientes', 'Calidad: encuesta del cliente y reunión mensual',
   'En la ficha de un cliente activo, tarjeta "Estado del servicio": ahora muestra la última calificación del cliente y si se hizo la reunión del mes (con botón para registrarla). La encuesta se comparte con el MISMO link del portal agregando /encuesta al final (o el botón Copiar link de encuesta). Probá: registrá una reunión, abrí la encuesta en otra pestaña, calificá y verificá que aparezca en la ficha y en /director.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
