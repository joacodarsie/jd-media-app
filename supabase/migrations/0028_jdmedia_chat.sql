-- JDmedIA: chat persistente full-page con historial por usuario.

create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null default 'Nueva conversación',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_ai_conv_updated on public.ai_conversations;
create trigger trg_ai_conv_updated before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create index if not exists idx_ai_conv_user_updated
  on public.ai_conversations(user_id, updated_at desc);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_ai_msg_conv_created
  on public.ai_messages(conversation_id, created_at);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists ai_conv_owner on public.ai_conversations;
create policy ai_conv_owner on public.ai_conversations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists ai_msg_owner on public.ai_messages;
create policy ai_msg_owner on public.ai_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );
