-- EMAIL EN FRÍO AUTOMÁTICO (el canal que sí escala sin arriesgar el WhatsApp).
--
-- Por qué email y no WhatsApp/IG masivo: WhatsApp banea el número por envío en
-- frío y es el MISMO número con el que la agencia habla con sus clientes. El
-- email en frío B2B es legal si se identifica el remitente y se puede dar de
-- baja en un clic — eso es lo que implementan estas tablas.
--
-- Piezas:
--  · prospecting_contacts.email  → la dirección que sacamos del sitio web
--  · cold_email_sends            → un envío por contacto, con estado y fecha
--  · cold_email_optouts          → lista de supresión: nunca más se le escribe

alter table public.prospecting_contacts
  add column if not exists email text;

create index if not exists idx_prospecting_contacts_email
  on public.prospecting_contacts (email)
  where email is not null;

-- ── Envíos ───────────────────────────────────────────────────────────────────
create table if not exists public.cold_email_sends (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid references public.prospecting_contacts(id) on delete cascade,
  campaign_id   uuid references public.prospecting_campaigns(id) on delete set null,
  email         text not null,
  asunto        text not null,
  cuerpo        text not null,
  -- pendiente → enviado | error | rebotado | respondido
  estado        text not null default 'pendiente',
  provider_id   text,
  error         text,
  -- Día en que le toca salir (el cron manda el lote del día).
  programado_para date not null default current_date,
  enviado_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- Una sola vez por dirección: nada de escribirle dos veces a la misma empresa.
create unique index if not exists idx_cold_email_sends_email_unico
  on public.cold_email_sends (lower(email));

create index if not exists idx_cold_email_sends_cola
  on public.cold_email_sends (estado, programado_para);

-- ── Bajas (supresión) ────────────────────────────────────────────────────────
create table if not exists public.cold_email_optouts (
  email      text primary key,
  motivo     text,
  created_at timestamptz not null default now()
);

alter table public.cold_email_sends enable row level security;
alter table public.cold_email_optouts enable row level security;

-- Lee y escribe quien trabaja el pipeline comercial. El cron y la baja pública
-- van por service role, que no pasa por RLS.
drop policy if exists cold_email_sends_rw on public.cold_email_sends;
create policy cold_email_sends_rw on public.cold_email_sends
  for all to authenticated
  using (public.jd_is_staff() or public.jd_has_role(array['comercial','prospecting']))
  with check (public.jd_is_staff() or public.jd_has_role(array['comercial','prospecting']));

drop policy if exists cold_email_optouts_read on public.cold_email_optouts;
create policy cold_email_optouts_read on public.cold_email_optouts
  for select to authenticated
  using (public.jd_is_staff() or public.jd_has_role(array['comercial','prospecting']));

insert into public.review_flags (ruta, label, nota)
values (
  '/prospeccion/email',
  'Email en frío automático',
  'Pantalla nueva. Probar: (1) "Buscar emails" completa la columna email de los contactos que tienen sitio web; (2) el previsualizador muestra el asunto y el cuerpo con [EMPRESA] reemplazado y el pie con la baja; (3) "Programar envíos" arma la cola respetando el tope diario; (4) el link de baja abre /baja/... y deja el mail en la lista de supresión. OJO: no se manda nada hasta que estén cargadas RESEND_API_KEY y COLD_EMAIL_FROM en Vercel.'
);
