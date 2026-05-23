-- Adjuntos en mensajes del chat de equipo. Archivos viven en bucket "documents"
-- bajo el prefijo chat/{user_id}/{channel_id}/...

create table if not exists public.chat_attachments (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references public.team_messages(id) on delete cascade,
  name          text not null,
  mime_type     text not null,
  storage_path  text not null,
  size          integer,
  created_at    timestamptz not null default now()
);

create index if not exists idx_chat_att_message on public.chat_attachments(message_id);

alter table public.chat_attachments enable row level security;

drop policy if exists chat_att_select on public.chat_attachments;
create policy chat_att_select on public.chat_attachments
  for select to authenticated
  using (
    exists (
      select 1
      from public.team_messages m
      join public.team_channel_members mem on mem.channel_id = m.channel_id
      where m.id = message_id and mem.user_id = (select auth.uid())
    )
  );

drop policy if exists chat_att_insert on public.chat_attachments;
create policy chat_att_insert on public.chat_attachments
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.team_messages m
      where m.id = message_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists chat_att_delete on public.chat_attachments;
create policy chat_att_delete on public.chat_attachments
  for delete to authenticated
  using (
    exists (
      select 1
      from public.team_messages m
      where m.id = message_id
        and (m.user_id = (select auth.uid()) or public.jd_is_staff())
    )
  );
