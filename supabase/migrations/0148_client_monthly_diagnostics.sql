-- Diagnóstico MENSUAL del cliente.
--
-- Distinto del diagnóstico inicial (client_diagnostics, 14 secciones, se le
-- manda al cliente en PDF): esto es INTERNO y sale de la reunión de fin de mes.
-- Se carga la transcripción del meet y la IA arma la foto de cómo está la marca
-- ese mes: qué funcionó, qué no, frustraciones, necesidades, si cambió el
-- público objetivo, qué aprendimos y qué ajustamos para el mes que viene.
--
-- Un diagnóstico por cliente y período. Se regenera pisando el anterior (queda
-- el historial mes a mes, que es lo que importa para ver la evolución).

create table if not exists public.client_monthly_diagnostics (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           uuid not null references public.clients(id) on delete cascade,
  periodo              text not null,                 -- 'YYYY-MM'
  content              jsonb not null default '{}'::jsonb,
  -- Versión AMIGABLE para mandarle al cliente. Sale del mismo análisis pero
  -- redactada para él: sin riesgo de churn, sin oportunidades de venta, sin las
  -- frustraciones catalogadas. Se ve en /c/<token>/mes/<periodo>.
  client_report        jsonb,
  client_report_at     timestamptz,
  shared_at            timestamptz,                   -- cuándo se compartió el link
  transcript_text      text,
  source_pdf_path      text,
  generated_with_model text,
  generated_at         timestamptz,
  tasks_created_at     timestamptz,
  tasks_created_count  int,
  created_by           uuid references public.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Por si la tabla ya existía de una corrida anterior de esta misma migración.
alter table public.client_monthly_diagnostics
  add column if not exists client_report    jsonb,
  add column if not exists client_report_at timestamptz,
  add column if not exists shared_at        timestamptz;

-- Uno por cliente y mes: regenerar pisa (upsert), no acumula versiones.
create unique index if not exists client_monthly_diagnostics_cliente_periodo_uniq
  on public.client_monthly_diagnostics (cliente_id, periodo);
create index if not exists client_monthly_diagnostics_cliente_idx
  on public.client_monthly_diagnostics (cliente_id, periodo desc);

alter table public.client_monthly_diagnostics enable row level security;

-- Documento interno del equipo: lo lee/edita cualquiera autenticado con acceso
-- a la app (el acceso por cliente lo filtra la página con requireClientAccess).
drop policy if exists client_monthly_diagnostics_all on public.client_monthly_diagnostics;
create policy client_monthly_diagnostics_all on public.client_monthly_diagnostics
  for all to authenticated
  using (true)
  with check (true);

-- La reunión mensual también guarda su guión por período (el de
-- client_monthly_reports.ai_meet_guion es el mismo dato, pero esa tabla vive en
-- el reporte del cliente; acá no duplicamos: la sección lo lee de ahí).

insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/clientes', 'Reunión mensual del cliente (guión + diagnóstico del mes)',
   'En la ficha de un cliente activo hay un botón nuevo "Reunión mensual". Adentro: (1) botón "Armar guión" que genera el ayudamemoria del meet con las métricas reales del mes y lo que quedó pendiente del mes pasado; (2) cargar la transcripción del meet (PDF de Tactiq, texto pegado o audio) y "Generar diagnóstico del mes", que arma la foto de la marca: qué funcionó, frustraciones, necesidades, si cambió el público objetivo, aprendizajes y acciones; (3) el informe AMIGABLE para el cliente, que se genera solo junto al diagnóstico y se comparte con el link del portal (/c/<token>/mes/<periodo>). Probá: generá el guión, cargá una transcripción y generá el diagnóstico, y después abrí "Ver informe del cliente" para revisar que no se filtre nada interno (riesgo, oportunidades de venta, frustraciones crudas) antes de mandarlo.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
