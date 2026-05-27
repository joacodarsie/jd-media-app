-- Reuniones internas del equipo JD Media, editables desde la app.
-- Complementa la agenda de Google Calendar (read-only) con reuniones agendadas
-- desde la propia app, con asistentes internos y notificacion automatica.

create table if not exists public.internal_meetings (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descripcion  text,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  ubicacion    text,
  meet_link    text,
  client_id    uuid references public.clients(id) on delete set null,
  created_by   uuid not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists internal_meetings_starts_idx on public.internal_meetings(starts_at);
create index if not exists internal_meetings_created_by_idx on public.internal_meetings(created_by);
create index if not exists internal_meetings_client_idx on public.internal_meetings(client_id);

create table if not exists public.internal_meeting_attendees (
  meeting_id uuid not null references public.internal_meetings(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  primary key (meeting_id, user_id)
);

create index if not exists internal_meeting_attendees_user_idx
  on public.internal_meeting_attendees(user_id);

-- Trigger updated_at
create or replace function public.touch_internal_meetings()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_internal_meetings on public.internal_meetings;
create trigger trg_touch_internal_meetings
  before update on public.internal_meetings
  for each row execute function public.touch_internal_meetings();

-- RLS: todos los usuarios autenticados ven todas las reuniones (es agenda de equipo).
-- Crear: cualquier autenticado. Editar/Borrar: solo creador o admin/coord.
alter table public.internal_meetings enable row level security;
alter table public.internal_meeting_attendees enable row level security;

drop policy if exists internal_meetings_select on public.internal_meetings;
create policy internal_meetings_select on public.internal_meetings
  for select to authenticated using (true);

drop policy if exists internal_meetings_insert on public.internal_meetings;
create policy internal_meetings_insert on public.internal_meetings
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists internal_meetings_update on public.internal_meetings;
create policy internal_meetings_update on public.internal_meetings
  for update to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin','coordinador')
    )
  );

drop policy if exists internal_meetings_delete on public.internal_meetings;
create policy internal_meetings_delete on public.internal_meetings
  for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin','coordinador')
    )
  );

drop policy if exists internal_meeting_attendees_select on public.internal_meeting_attendees;
create policy internal_meeting_attendees_select on public.internal_meeting_attendees
  for select to authenticated using (true);

drop policy if exists internal_meeting_attendees_write on public.internal_meeting_attendees;
create policy internal_meeting_attendees_write on public.internal_meeting_attendees
  for all to authenticated
  using (
    exists (
      select 1 from public.internal_meetings m
      where m.id = meeting_id and (
        m.created_by = auth.uid()
        or exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.rol in ('admin','coordinador')
        )
      )
    )
  )
  with check (
    exists (
      select 1 from public.internal_meetings m
      where m.id = meeting_id and (
        m.created_by = auth.uid()
        or exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.rol in ('admin','coordinador')
        )
      )
    )
  );

-- Agregar columna link a notifications para que las notifs no atadas a tareas
-- (ej. recordatorio de reunion) puedan navegar a una ruta especifica.
alter table public.notifications add column if not exists link text;
