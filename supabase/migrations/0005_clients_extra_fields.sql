-- Etapa 5: campos extra para clientes (links a calendario/drive, contacto, notas)
alter table public.clients
  add column if not exists calendario_url text,
  add column if not exists drive_url text,
  add column if not exists contacto_nombre text,
  add column if not exists contacto_email text,
  add column if not exists contacto_telefono text,
  add column if not exists notas text,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_clients_updated on public.clients;
create trigger trg_clients_updated before update on public.clients
  for each row execute function public.set_updated_at();

-- Responsable de cuenta puede editar sus clientes; staff edita todo.
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update to authenticated
  using (
    public.jd_is_staff()
    or creativa_asignada_id = (select auth.uid())
  )
  with check (
    public.jd_is_staff()
    or creativa_asignada_id = (select auth.uid())
  );
