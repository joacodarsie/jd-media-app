-- Notificaciones cuando te mencionan en chat + helper de unread count.

create or replace function public.trigger_notify_team_mention()
returns trigger language plpgsql security definer as $$
declare
  v_channel_name text;
  v_author_name  text;
  m uuid;
begin
  if array_length(new.mentions, 1) is null then return new; end if;

  select name into v_channel_name from public.team_channels where id = new.channel_id;
  select nombre into v_author_name from public.users where id = new.user_id;

  foreach m in array new.mentions loop
    if m = new.user_id then continue; end if;
    insert into public.notifications (user_id, tipo, mensaje, leida, created_at)
    values (
      m,
      'mencion',
      coalesce(v_author_name, 'Alguien') || ' te mencionó en #' || coalesce(v_channel_name, 'chat'),
      false,
      now()
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_team_mention on public.team_messages;
create trigger trg_notify_team_mention
  after insert on public.team_messages
  for each row execute function public.trigger_notify_team_mention();

-- Función que devuelve cantidad de mensajes de chat no leídos para un user.
-- Cuenta mensajes en canales donde el user es miembro,
-- posteriores a su last_read_at, y que NO son del propio user.
create or replace function public.team_chat_unread_count(p_user_id uuid)
returns integer language sql stable security definer as $$
  select coalesce(count(*), 0)::int
  from public.team_messages tm
  join public.team_channel_members tcm
    on tcm.channel_id = tm.channel_id and tcm.user_id = p_user_id
  where tm.user_id is distinct from p_user_id
    and tm.created_at > coalesce(tcm.last_read_at, '1970-01-01'::timestamptz);
$$;
