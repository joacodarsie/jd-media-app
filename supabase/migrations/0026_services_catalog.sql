-- Catálogo de servicios que ofrece la agencia.
-- El slug puede coincidir con un valor del enum service_type para que
-- client_services.tipo pueda mostrar el name/description del catálogo.
-- No reemplaza al enum: actúa como tabla de referencia editable.

create table if not exists public.services (
  slug         text primary key,
  name         text not null,
  description  text,
  color        text,
  icon         text,
  areas        text[] not null default '{}'::text[],
  orden        int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_services_updated on public.services;
create trigger trg_services_updated before update on public.services
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;

drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select to authenticated using (true);

drop policy if exists services_write on public.services;
create policy services_write on public.services
  for all to authenticated
  using (public.jd_is_staff())
  with check (public.jd_is_staff());

create index if not exists idx_services_orden on public.services(orden);
