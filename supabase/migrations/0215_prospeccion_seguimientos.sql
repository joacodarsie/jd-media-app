-- Prospección (22/10/2026): cada seguimiento que se manda, con quién y cuándo.
-- El dueño pidió medir los seguimientos como un objetivo aparte de los
-- contactos nuevos («por un lado los contactos nuevos, por otro los
-- seguimientos»). prospecting_contacts solo guarda el último (seguimiento_at)
-- y no quién lo mandó: con eso no se puede contar por persona ni por semana.
create table if not exists public.prospecting_followups (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.prospecting_contacts(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  numero smallint not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists prospecting_followups_user_fecha on public.prospecting_followups (user_id, created_at);

alter table public.prospecting_followups enable row level security;
-- Lo escribe y lo lee el servidor con la clave de servicio; el equipo lo puede leer.
drop policy if exists "equipo lee seguimientos" on public.prospecting_followups;
create policy "equipo lee seguimientos" on public.prospecting_followups
  for select to authenticated using (true);
