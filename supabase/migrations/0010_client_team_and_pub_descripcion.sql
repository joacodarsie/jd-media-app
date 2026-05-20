-- Etapa 17: equipo asignado por cliente (CM + Diseñador + Audiovisual)
alter table public.clients
  add column if not exists cm_id uuid references public.users(id) on delete set null,
  add column if not exists disenador_id uuid references public.users(id) on delete set null,
  add column if not exists audiovisual_id uuid references public.users(id) on delete set null;

create index if not exists idx_clients_cm on public.clients(cm_id);
create index if not exists idx_clients_disenador on public.clients(disenador_id);
create index if not exists idx_clients_audiovisual on public.clients(audiovisual_id);

-- Descripción de la idea (CM le explica al diseñador/audiovisual la pieza a crear)
alter table public.publications
  add column if not exists descripcion text;
