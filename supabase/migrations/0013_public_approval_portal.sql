-- Sprint 1: portal público de aprobación para clientes (sin login).
-- Cada cliente recibe un approval_token único. La URL /aprobacion/<token>
-- muestra las publicaciones en estado 'revision_cliente' y permite aprobar
-- o pedir cambios. Las operaciones se hacen vía RPCs SECURITY DEFINER
-- que validan el token, así NO exponemos service_role al frontend.

-- 1) Columnas nuevas
alter table public.clients
  add column if not exists approval_token text unique;

-- backfill: asigna un token a cada cliente que no tenga
update public.clients
  set approval_token = replace(gen_random_uuid()::text, '-', '')
  where approval_token is null;

alter table public.clients
  alter column approval_token set default replace(gen_random_uuid()::text, '-', '');

alter table public.publications
  add column if not exists cliente_revision_iniciada_at  timestamptz,
  add column if not exists cliente_revision_completada_at timestamptz;

create index if not exists idx_publications_cliente_rev_started
  on public.publications(cliente_revision_iniciada_at);

-- 2) Trigger: registrar timestamps de inicio/fin de revisión cliente
create or replace function public.jd_publication_review_timestamps() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    if new.estado = 'revision_cliente' and new.cliente_revision_iniciada_at is null then
      new.cliente_revision_iniciada_at := now();
    end if;
    if old.estado = 'revision_cliente'
       and new.estado in ('aprobado','rechazado','publicado')
       and new.cliente_revision_completada_at is null then
      new.cliente_revision_completada_at := now();
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.jd_publication_review_timestamps() from anon, authenticated, public;

drop trigger if exists trg_publications_review_ts on public.publications;
create trigger trg_publications_review_ts
  before update on public.publications
  for each row execute function public.jd_publication_review_timestamps();

-- 3) RPCs públicas para el portal de aprobación
-- get_client_by_token: devuelve cliente + publicaciones en revisión cliente
create or replace function public.jd_get_approval_payload(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
  v_pubs jsonb;
begin
  select * into v_client from public.clients where approval_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'token invalido');
  end if;

  select coalesce(jsonb_agg(p order by p.fecha_publicacion asc), '[]'::jsonb)
    into v_pubs
  from (
    select id, titulo, descripcion, copy, guion, red, tipo,
           fecha_publicacion, hashtags, asset_url, referencia_url,
           estado, notas_revision, cliente_revision_iniciada_at
    from public.publications
    where cliente_id = v_client.id
      and estado in ('revision_cliente','aprobado','rechazado','publicado')
    order by fecha_publicacion desc nulls last
    limit 50
  ) p;

  return jsonb_build_object(
    'ok', true,
    'cliente', jsonb_build_object('id', v_client.id, 'nombre', v_client.nombre),
    'publicaciones', v_pubs
  );
end;
$$;

grant execute on function public.jd_get_approval_payload(text) to anon, authenticated;

-- jd_client_decision: el cliente aprueba o pide cambios
create or replace function public.jd_client_decision(
  p_token text,
  p_pub_id uuid,
  p_decision text,        -- 'aprobado' | 'rechazado'
  p_comentario text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_pub_client uuid;
  v_creador uuid;
  v_titulo text;
begin
  if p_decision not in ('aprobado','rechazado') then
    return jsonb_build_object('ok', false, 'error', 'decision invalida');
  end if;

  select id into v_client_id from public.clients where approval_token = p_token;
  if v_client_id is null then
    return jsonb_build_object('ok', false, 'error', 'token invalido');
  end if;

  select cliente_id, creado_por_id, titulo
    into v_pub_client, v_creador, v_titulo
  from public.publications where id = p_pub_id;

  if v_pub_client is null then
    return jsonb_build_object('ok', false, 'error', 'publicacion no encontrada');
  end if;
  if v_pub_client <> v_client_id then
    return jsonb_build_object('ok', false, 'error', 'publicacion no pertenece al cliente');
  end if;

  update public.publications
     set estado = p_decision::publication_status,
         notas_revision = coalesce(p_comentario, notas_revision),
         cliente_revision_completada_at = now()
   where id = p_pub_id;

  -- notificar al creador
  if v_creador is not null then
    insert into public.notifications(user_id, task_id, tipo, mensaje)
    select v_creador, null, 'asignacion',
           (case when p_decision='aprobado' then 'Cliente aprobó: ' else 'Cliente pidió cambios en: ' end)
             || coalesce(v_titulo,'pieza');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.jd_client_decision(text, uuid, text, text) to anon, authenticated;
