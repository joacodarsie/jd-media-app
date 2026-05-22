-- WhatsApp notification infrastructure (ready-to-wire para Botly).
-- 1) Teléfono + opt-in por user
-- 2) Cola de mensajes pendientes que Botly puede leer y marcar como enviados
-- 3) Trigger que copia notifications a la cola si el user tiene opt-in.

alter table public.users
  add column if not exists whatsapp_phone text,
  add column if not exists whatsapp_optin boolean not null default false;

create table if not exists public.notification_queue (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  channel         text not null default 'whatsapp' check (channel in ('whatsapp', 'email')),
  -- Snapshot del destino al momento del envío (por si el user cambia el número)
  phone           text,
  email           text,
  -- Contenido
  mensaje         text not null,
  link            text,
  -- Ligar a la notif original si vino de ahí
  notification_id uuid references public.notifications(id) on delete set null,
  -- Estado
  status          text not null default 'pendiente' check (status in ('pendiente','enviado','fallido','cancelado')),
  intentos        integer not null default 0,
  error_msg       text,
  created_at      timestamptz not null default now(),
  enviado_at      timestamptz
);

create index if not exists idx_nq_status on public.notification_queue(status, created_at);
create index if not exists idx_nq_user on public.notification_queue(user_id, created_at desc);

alter table public.notification_queue enable row level security;

-- Cada user ve sus propios mensajes (debug). Staff ve todo.
drop policy if exists nq_select on public.notification_queue;
create policy nq_select on public.notification_queue
  for select to authenticated
  using (user_id = (select auth.uid()) or public.jd_is_staff());

-- Solo el sistema (trigger SECURITY DEFINER) inserta y actualiza.

-- Trigger: cuando se inserta una notification, si el user tiene WA opt-in,
-- también encolar un mensaje en notification_queue.
create or replace function public.jd_enqueue_wa_notification() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_phone text;
  v_optin boolean;
  v_msg text;
begin
  select whatsapp_phone, whatsapp_optin into v_phone, v_optin
  from public.users where id = new.user_id;

  if not coalesce(v_optin, false) or v_phone is null or v_phone = '' then
    return new;
  end if;

  v_msg := new.mensaje;
  insert into public.notification_queue(user_id, channel, phone, mensaje, notification_id)
  values (new.user_id, 'whatsapp', v_phone, v_msg, new.id);

  return new;
end;
$$;

revoke execute on function public.jd_enqueue_wa_notification() from anon, authenticated, public;

drop trigger if exists trg_notifications_enqueue_wa on public.notifications;
create trigger trg_notifications_enqueue_wa
  after insert on public.notifications
  for each row execute function public.jd_enqueue_wa_notification();

-- RPC público (con secret) para Botly: leer pendientes
create or replace function public.jd_wa_queue_pending(p_secret text, p_limit integer default 50)
returns table (
  id uuid,
  user_id uuid,
  phone text,
  mensaje text,
  link text,
  created_at timestamptz
)
language plpgsql security definer
set search_path = public
as $$
declare
  v_expected text;
begin
  -- El secret se setea en una tabla `app_secrets` (admin only).
  -- Si no existe, retorna nada.
  select valor into v_expected from public.app_secrets where clave = 'wa_queue_secret' limit 1;
  if v_expected is null or v_expected = '' or v_expected <> p_secret then
    return;
  end if;

  return query
    select q.id, q.user_id, q.phone, q.mensaje, q.link, q.created_at
    from public.notification_queue q
    where q.status = 'pendiente'
      and q.channel = 'whatsapp'
      and q.phone is not null
    order by q.created_at asc
    limit greatest(1, least(p_limit, 200));
end;
$$;

grant execute on function public.jd_wa_queue_pending(text, integer) to anon, authenticated;

-- RPC para que Botly marque un mensaje como enviado o fallido
create or replace function public.jd_wa_queue_mark(
  p_secret text,
  p_id uuid,
  p_status text,
  p_error text default null
) returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_expected text;
begin
  select valor into v_expected from public.app_secrets where clave = 'wa_queue_secret' limit 1;
  if v_expected is null or v_expected <> p_secret then
    return false;
  end if;
  if p_status not in ('enviado','fallido') then
    return false;
  end if;
  update public.notification_queue
    set status = p_status,
        intentos = intentos + 1,
        error_msg = case when p_status = 'fallido' then coalesce(p_error, 'sin detalle') else null end,
        enviado_at = case when p_status = 'enviado' then now() else enviado_at end
   where id = p_id;
  return true;
end;
$$;

grant execute on function public.jd_wa_queue_mark(text, uuid, text, text) to anon, authenticated;

-- Tabla simple para secrets internos (solo admin)
create table if not exists public.app_secrets (
  clave  text primary key,
  valor  text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;
drop policy if exists app_secrets_admin on public.app_secrets;
create policy app_secrets_admin on public.app_secrets
  for all to authenticated
  using (
    exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol = 'admin')
  )
  with check (
    exists (select 1 from public.users u where u.id = (select auth.uid()) and u.rol = 'admin')
  );
