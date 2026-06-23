-- Prospección IA: captación de clientes por fuera de la pauta publicitaria.
-- Una "campaña" es un CLUSTER de ventas: un rubro/nicho homogéneo en una zona,
-- con un servicio y un ángulo claros. La IA busca empresas REALES del cluster
-- (búsqueda web, con fuente verificable) y arma un primer mensaje personalizado
-- para cada una. El envío hoy es manual (WhatsApp click-to-chat / Instagram);
-- queda preparado para automatizar con Botly más adelante.

create table if not exists public.prospecting_campaigns (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,                    -- ej: "Gimnasios premium Córdoba"
  rubro        text not null,                    -- nicho/rubro objetivo (gimnasios, restaurantes, estudios jurídicos…)
  ubicacion    text,                             -- país/ciudad objetivo ("Córdoba, Argentina" / "Madrid, España")
  servicio     text references public.services(slug) on delete set null, -- servicio principal a ofrecer
  angulo       text,                             -- problema que resolvemos / propuesta de valor para este cluster
  canal        text not null default 'whatsapp', -- whatsapp | instagram | email
  idioma       text not null default 'es_ar',    -- es_ar | es | en
  estado       text not null default 'activa',   -- activa | pausada
  created_by   uuid references public.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.prospecting_leads (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.prospecting_campaigns(id) on delete cascade,
  empresa      text not null,
  descripcion  text,                             -- qué hace la empresa (1-2 frases)
  ciudad       text,
  pais         text,
  sitio_web    text,
  instagram    text,                             -- handle o URL
  telefono     text,                             -- formato internacional (+54…, +34…) cuando está público
  email        text,
  por_que      text,                             -- la señal: por qué es buen lead para nosotros
  fit_score    int,                              -- 0..100 ajuste al cluster
  fuente_url   text,                             -- de dónde salió el dato (verificable)
  mensaje      text,                             -- primer mensaje personalizado generado por IA
  estado       text not null default 'nuevo',    -- nuevo | contactado | respondio | reunion | descartado | ganado
  notas        text,
  cliente_id   uuid references public.clients(id) on delete set null, -- si se convirtió en propuesta/cliente
  fuente       text not null default 'ia',       -- ia | manual
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Dedup: no repetir la misma empresa dentro de una misma campaña.
create unique index if not exists prospecting_leads_campaign_empresa_uniq
  on public.prospecting_leads (campaign_id, lower(empresa));

create index if not exists prospecting_leads_campaign_idx
  on public.prospecting_leads (campaign_id, fit_score desc);

drop trigger if exists trg_prospecting_campaigns_updated on public.prospecting_campaigns;
create trigger trg_prospecting_campaigns_updated before update on public.prospecting_campaigns
  for each row execute function public.set_updated_at();

drop trigger if exists trg_prospecting_leads_updated on public.prospecting_leads;
create trigger trg_prospecting_leads_updated before update on public.prospecting_leads
  for each row execute function public.set_updated_at();

alter table public.prospecting_campaigns enable row level security;
alter table public.prospecting_leads enable row level security;

-- Acceso: staff (admin/coordinación) + comercial/prospecting, igual que el
-- pipeline de leads (migración 0030).
drop policy if exists prospecting_campaigns_all on public.prospecting_campaigns;
create policy prospecting_campaigns_all on public.prospecting_campaigns
  for all to authenticated
  using (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol in ('comercial','prospecting'))
  )
  with check (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol in ('comercial','prospecting'))
  );

drop policy if exists prospecting_leads_all on public.prospecting_leads;
create policy prospecting_leads_all on public.prospecting_leads
  for all to authenticated
  using (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol in ('comercial','prospecting'))
  )
  with check (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol in ('comercial','prospecting'))
  );
