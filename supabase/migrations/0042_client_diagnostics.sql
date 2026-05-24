-- Diagnóstico inicial por cliente: el documento estratégico que JDmedIA usa
-- como brief para sugerir calendario, copy, ideas. Versionado para mantener
-- historial cuando un cliente evoluciona.

-- 1) Tabla principal: una fila por versión de diagnóstico.
create table if not exists public.client_diagnostics (
  id                       uuid primary key default gen_random_uuid(),
  cliente_id               uuid not null references public.clients(id) on delete cascade,
  version                  int  not null,
  status                   text not null default 'draft'
                             check (status in ('draft','approved','archived')),
  -- Contenido estructurado en jsonb: las 14 secciones del informe.
  -- Schema documentado en src/lib/diagnostics/schema.ts
  content                  jsonb not null default '{}'::jsonb,
  -- Transcripción cruda del meet de onboarding (texto extraído del PDF de Tactiq).
  transcript_text          text,
  -- Path del PDF original en el bucket diagnostic-sources (opcional, para auditoría).
  source_pdf_path          text,
  -- Modelo y prompt version usados para generar (para reproducibilidad).
  generated_with_model     text,
  generated_at             timestamptz,
  approved_at              timestamptz,
  approved_by              uuid references auth.users(id),
  -- Una vez que el plan de acción se convirtió a tareas, se marca acá
  -- para evitar duplicados.
  tasks_created_at         timestamptz,
  tasks_created_count      int,
  created_by               uuid references auth.users(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (cliente_id, version)
);

create index if not exists idx_client_diagnostics_cliente
  on public.client_diagnostics (cliente_id, version desc);

create index if not exists idx_client_diagnostics_approved
  on public.client_diagnostics (cliente_id)
  where status = 'approved';

drop trigger if exists trg_cd_updated on public.client_diagnostics;
create trigger trg_cd_updated before update on public.client_diagnostics
  for each row execute function public.set_updated_at();

-- 2) Helper para obtener el próximo número de versión por cliente.
create or replace function public.next_diagnostic_version(p_cliente uuid)
returns int language plpgsql as $$
declare v_next int;
begin
  select coalesce(max(version), 0) + 1
    into v_next
    from public.client_diagnostics
    where cliente_id = p_cliente;
  return v_next;
end $$;

-- 3) RLS: staff full access, asignados del cliente (CM/creativa) pueden ver y editar.
alter table public.client_diagnostics enable row level security;

drop policy if exists cd_select on public.client_diagnostics;
create policy cd_select on public.client_diagnostics
  for select to authenticated using (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_diagnostics.cliente_id
        and (c.creativa_asignada_id = (select auth.uid()) or c.cm_id = (select auth.uid()))
    )
  );

drop policy if exists cd_modify on public.client_diagnostics;
create policy cd_modify on public.client_diagnostics
  for all to authenticated
  using (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_diagnostics.cliente_id
        and (c.creativa_asignada_id = (select auth.uid()) or c.cm_id = (select auth.uid()))
    )
  )
  with check (
    public.jd_is_staff() or exists (
      select 1 from public.clients c
      where c.id = client_diagnostics.cliente_id
        and (c.creativa_asignada_id = (select auth.uid()) or c.cm_id = (select auth.uid()))
    )
  );

-- 4) Bucket privado para los PDFs de Tactiq.
-- Idempotente: solo crea si no existe.
insert into storage.buckets (id, name, public)
  values ('diagnostic-sources', 'diagnostic-sources', false)
  on conflict (id) do nothing;

-- Solo staff puede leer/subir las transcripciones originales.
drop policy if exists "diagnostic_sources_read" on storage.objects;
create policy "diagnostic_sources_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'diagnostic-sources' and public.jd_is_staff());

drop policy if exists "diagnostic_sources_write" on storage.objects;
create policy "diagnostic_sources_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'diagnostic-sources' and public.jd_is_staff());

drop policy if exists "diagnostic_sources_delete" on storage.objects;
create policy "diagnostic_sources_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'diagnostic-sources' and public.jd_is_staff());

-- 5) Agregar paso al checklist de onboarding existente.
alter table public.client_onboarding
  add column if not exists diagnostico_generado_at timestamptz;
