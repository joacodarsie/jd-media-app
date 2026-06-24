-- Asesor financiero: guarda el último análisis con IA por período. La idea es
-- que la app NO solo muestre números, sino que te diga en criollo CÓMO venís y
-- QUÉ hacer. Se regenera a pedido (botón) y se cachea acá para no llamar a la IA
-- en cada visita. Es información estratégica/privada → solo admin.
create table if not exists public.financial_advice (
  periodo         text primary key,                 -- YYYY-MM
  score           int,                              -- 0..100 salud financiera
  estado          text,                             -- 1 frase: cómo venís
  fortalezas      jsonb not null default '[]'::jsonb,
  riesgos         jsonb not null default '[]'::jsonb,
  recomendaciones jsonb not null default '[]'::jsonb, -- [{titulo, detalle, prioridad, link}]
  snapshot        jsonb,                            -- los números que vio (auditar)
  generado_por    uuid references public.users(id),
  generado_at     timestamptz not null default now()
);

alter table public.financial_advice enable row level security;

-- Solo admin (igual que las deudas: posición financiera privada).
drop policy if exists financial_advice_admin on public.financial_advice;
create policy financial_advice_admin on public.financial_advice
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol = 'admin'))
  with check (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol = 'admin'));
