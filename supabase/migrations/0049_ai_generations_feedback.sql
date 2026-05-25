-- Feedback de outputs IA para mejorar prompts a lo largo del tiempo.
-- Cada generacion (diagnostico, plan, guia, suggest, etc) puede recibir un voto
-- positivo o negativo + comentario opcional.

create table if not exists public.ai_generations_feedback (
  id              uuid primary key default gen_random_uuid(),
  -- Que tipo de generacion: 'diagnostic', 'content_plan', 'meet_guide',
  -- 'pub_suggester', 'plan_tema', etc. Texto libre para flexibilidad.
  feature         text not null,
  -- Referencia al objeto generado (puede ser id de client_diagnostics,
  -- client_content_plans, publications, etc. — segun el feature).
  ref_id          uuid,
  -- Cliente al que pertenece el output (si aplica)
  cliente_id      uuid references public.clients(id) on delete set null,
  -- Modelo que produjo el output (ej "claude-sonnet-4-6").
  model           text,
  -- 1 = thumbs up, -1 = thumbs down.
  rating          smallint not null check (rating in (-1, 1)),
  -- Comentario corto opcional del usuario.
  comentario      text,
  user_id         uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_aigfb_feature
  on public.ai_generations_feedback (feature, created_at desc);
create index if not exists idx_aigfb_ref
  on public.ai_generations_feedback (ref_id);
create index if not exists idx_aigfb_cliente
  on public.ai_generations_feedback (cliente_id);

alter table public.ai_generations_feedback enable row level security;

-- Cualquier user autenticado puede insertar y leer sus propios votos;
-- admins/coordinadores leen todo.
drop policy if exists aigfb_select on public.ai_generations_feedback;
create policy aigfb_select on public.ai_generations_feedback
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin','coordinador')
    )
  );

drop policy if exists aigfb_insert on public.ai_generations_feedback;
create policy aigfb_insert on public.ai_generations_feedback
  for insert with check (auth.uid() = user_id);
