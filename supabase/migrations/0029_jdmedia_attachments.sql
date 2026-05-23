-- Adjuntos a mensajes de JDmedIA. Archivos viven en bucket "documents"
-- bajo el prefijo jdmedia/{user_id}/{conv_id}/...

create table if not exists public.ai_attachments (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references public.ai_messages(id) on delete cascade,
  name          text not null,
  mime_type     text not null,
  storage_path  text not null,
  size          integer,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ai_att_message on public.ai_attachments(message_id);

alter table public.ai_attachments enable row level security;

drop policy if exists ai_att_owner on public.ai_attachments;
create policy ai_att_owner on public.ai_attachments
  for all to authenticated
  using (
    exists (
      select 1
      from public.ai_messages m
      join public.ai_conversations c on c.id = m.conversation_id
      where m.id = message_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.ai_messages m
      join public.ai_conversations c on c.id = m.conversation_id
      where m.id = message_id
        and c.user_id = (select auth.uid())
    )
  );
