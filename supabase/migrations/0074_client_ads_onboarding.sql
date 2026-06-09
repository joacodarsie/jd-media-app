-- Onboarding del servicio de PUBLICIDAD DIGITAL (paid media) por cliente.
-- Checklist de los pasos que hace el media buyer (Guille) al tomar una cuenta
-- nueva de pauta. Separado del onboarding general de gestión de redes.

create table if not exists public.client_ads_onboarding (
  cliente_id              uuid primary key references public.clients(id) on delete cascade,
  -- Pasos (timestamp = hecho)
  accesos_fb_at           timestamptz,   -- accesos a la cuenta de Facebook del cliente
  ads_manager_at          timestamptz,   -- crear / acceder al administrador de anuncios de Meta
  dolar_app_at            timestamptz,   -- el cliente descargó Dólar App (evitar impuestos)
  tarjeta_vinculada_at    timestamptz,   -- vincular la tarjeta global de Dólar App con la cuenta de ads
  campanas_definidas_at   timestamptz,   -- definir y armar las campañas clave
  campanas_publicadas_at  timestamptz,   -- publicar las campañas
  -- Detalle libre
  campanas_notas          text,          -- qué campañas clave se definieron
  notas                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

drop trigger if exists trg_cao_updated on public.client_ads_onboarding;
create trigger trg_cao_updated before update on public.client_ads_onboarding
  for each row execute function public.set_updated_at();

alter table public.client_ads_onboarding enable row level security;

-- Lo ven y editan: staff (admin/coordinador) y el media buyer (rol paid_media).
drop policy if exists cao_select on public.client_ads_onboarding;
create policy cao_select on public.client_ads_onboarding
  for select to authenticated using (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol = 'paid_media')
  );

drop policy if exists cao_modify on public.client_ads_onboarding;
create policy cao_modify on public.client_ads_onboarding
  for all to authenticated
  using (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol = 'paid_media')
  )
  with check (
    public.jd_is_staff()
    or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol = 'paid_media')
  );
