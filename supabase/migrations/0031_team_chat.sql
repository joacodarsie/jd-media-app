-- Chat interno del equipo: canales públicos + mensajes con @menciones.
-- v1: solo canales públicos (sin DMs aún).

do $$ begin
  create type team_channel_kind as enum ('public', 'dm');
exception when duplicate_object then null; end $$;

create table if not exists public.team_channels (
  id          uuid primary key default gen_random_uuid(),
  kind        team_channel_kind not null default 'public',
  name        text not null,
  description text,
  archived    boolean not null default false,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_team_channels_updated on public.team_channels;
create trigger trg_team_channels_updated before update on public.team_channels
  for each row execute function public.set_updated_at();

create unique index if not exists idx_team_channels_name on public.team_channels(name)
  where kind = 'public';

create table if not exists public.team_channel_members (
  channel_id  uuid not null references public.team_channels(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (channel_id, user_id)
);

create index if not exists idx_tcm_user on public.team_channel_members(user_id);

create table if not exists public.team_messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references public.team_channels(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete set null,
  content     text not null,
  mentions    uuid[] not null default '{}'::uuid[],
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);

create index if not exists idx_tm_channel_created on public.team_messages(channel_id, created_at);
create index if not exists idx_tm_user on public.team_messages(user_id);

alter table public.team_channels enable row level security;
alter table public.team_channel_members enable row level security;
alter table public.team_messages enable row level security;

-- Channels: cualquier autenticado los ve. Solo staff los crea/edita.
drop policy if exists tc_select on public.team_channels;
create policy tc_select on public.team_channels
  for select to authenticated using (true);

drop policy if exists tc_write on public.team_channels;
create policy tc_write on public.team_channels
  for all to authenticated
  using (public.jd_is_staff())
  with check (public.jd_is_staff());

-- Members: cada user ve sus filas + las del canal donde pertenece. Staff ve todo.
drop policy if exists tcm_select on public.team_channel_members;
create policy tcm_select on public.team_channel_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.jd_is_staff()
    or exists (
      select 1 from public.team_channel_members m2
      where m2.channel_id = team_channel_members.channel_id
        and m2.user_id = (select auth.uid())
    )
  );

drop policy if exists tcm_write on public.team_channel_members;
create policy tcm_write on public.team_channel_members
  for all to authenticated
  using (public.jd_is_staff() or user_id = (select auth.uid()))
  with check (public.jd_is_staff() or user_id = (select auth.uid()));

-- Messages: ve y escribe quien sea miembro del canal.
drop policy if exists tm_select on public.team_messages;
create policy tm_select on public.team_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.team_channel_members m
      where m.channel_id = team_messages.channel_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists tm_insert on public.team_messages;
create policy tm_insert on public.team_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.team_channel_members m
      where m.channel_id = team_messages.channel_id
        and m.user_id = (select auth.uid())
    )
  );

-- Solo el autor o staff puede editar/borrar
drop policy if exists tm_update on public.team_messages;
create policy tm_update on public.team_messages
  for update to authenticated
  using (user_id = (select auth.uid()) or public.jd_is_staff());

drop policy if exists tm_delete on public.team_messages;
create policy tm_delete on public.team_messages
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.jd_is_staff());

-- Realtime: agregar a la publicación supabase_realtime
do $$ begin
  alter publication supabase_realtime add table public.team_messages;
exception when duplicate_object then null; end $$;
