-- Prospección: "Contactos (modo rápido)" — una tabla liviana tipo Excel, aparte
-- del pipeline de leads. La idea es escanear volumen alto (200/semana por
-- persona) con MUY pocos tokens: la IA solo trae empresa + persona de contacto +
-- rol + teléfono, sin verificar Instagram ni generar mensajes. El equipo edita la
-- tabla a mano para clasificar y repartir quién contacta a cada uno, y la exporta.
create table if not exists public.prospecting_contacts (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.prospecting_campaigns(id) on delete cascade,
  empresa        text not null,
  contacto_nombre text,                          -- persona con quien hablar (para saludar en el WhatsApp)
  contacto_rol   text,                           -- cargo/rol dentro de la empresa (dueño, gerente…)
  telefono       text,                           -- internacional (+54…, +34…) cuando está público
  estado         text not null default 'nuevo',  -- nuevo | contactado | interesado | descartado
  asignado_a     uuid references public.users(id) on delete set null, -- quién lo contacta
  notas          text,                           -- columna libre para clasificar
  fuente         text not null default 'ia',     -- ia | manual
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Dedup: no repetir la misma empresa dentro de una misma campaña.
create unique index if not exists prospecting_contacts_campaign_empresa_uniq
  on public.prospecting_contacts (campaign_id, lower(empresa));
create index if not exists prospecting_contacts_campaign_idx
  on public.prospecting_contacts (campaign_id, created_at desc);

drop trigger if exists trg_prospecting_contacts_updated on public.prospecting_contacts;
create trigger trg_prospecting_contacts_updated before update on public.prospecting_contacts
  for each row execute function public.set_updated_at();

alter table public.prospecting_contacts enable row level security;

-- Mismo acceso que el resto de prospección: staff (admin/coordinación) +
-- comercial/prospecting.
drop policy if exists prospecting_contacts_all on public.prospecting_contacts;
create policy prospecting_contacts_all on public.prospecting_contacts
  for all to authenticated
  using (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol in ('comercial','prospecting'))
  )
  with check (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol in ('comercial','prospecting'))
  );

-- Aura "sin testear" hasta que el dueño la apruebe.
insert into public.review_flags (ruta, label, nota)
select v.ruta, v.label, v.nota
from (values
  ('/prospeccion', 'Contactos (modo rápido)',
   'Entrá a una campaña → "Contactos (rápido)". Tocá "Sacar contactos": la IA trae empresa + persona + rol + teléfono con pocos tokens (sin mensajes ni verificación de IG). Probá editar una celda, cambiar estado y "quién contacta", y exportar a CSV/Excel.')
) as v(ruta, label, nota)
where not exists (
  select 1 from public.review_flags rf
  where rf.ruta = v.ruta and rf.label = v.label
);
