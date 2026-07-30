-- Qué dice el cierre del email en frío: la oferta y los links de la agencia.
--
-- Va en base y no en variables de entorno porque el dueño tiene que poder
-- leerlo y cambiarlo él, sin tocar Vercel ni pedirle nada a nadie.

create table if not exists public.cold_email_settings (
  id          boolean primary key default true check (id),
  -- El gancho medible: "$50.000 de descuento el primer mes".
  oferta      text,
  -- Código que el prospecto menciona al escribir. Es lo que permite saber
  -- cuántos clientes salieron del mail y no de otro lado.
  codigo      text default 'MAIL50',
  web         text,
  instagram   text,
  whatsapp    text,
  firma       text,
  updated_at  timestamptz not null default now()
);

insert into public.cold_email_settings (id, oferta, codigo, web, instagram, whatsapp, firma)
values (
  true,
  '$50.000 de descuento en el primer mes',
  'MAIL50',
  null,
  null,
  null,
  'Joaquín Darsie'
)
on conflict (id) do nothing;

alter table public.cold_email_settings enable row level security;

drop policy if exists cold_email_settings_read on public.cold_email_settings;
create policy cold_email_settings_read on public.cold_email_settings
  for select to authenticated using (true);

drop policy if exists cold_email_settings_write on public.cold_email_settings;
create policy cold_email_settings_write on public.cold_email_settings
  for all to authenticated
  using (public.jd_is_staff())
  with check (public.jd_is_staff());
