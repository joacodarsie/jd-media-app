-- C8: comentarios del cliente sobre publicaciones (vía portal público con token).
-- El cliente no tiene auth.user, así que dejamos user_id null y guardamos contenido + timestamp.

create table if not exists public.client_pub_comments (
  id              uuid primary key default gen_random_uuid(),
  publication_id  uuid not null references public.publications(id) on delete cascade,
  cliente_id      uuid not null references public.clients(id) on delete cascade,
  contenido       text not null,
  visto_por_id    uuid references public.users(id) on delete set null,
  visto_at        timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_cpc_pub on public.client_pub_comments(publication_id, created_at desc);
create index if not exists idx_cpc_cliente on public.client_pub_comments(cliente_id, created_at desc);

alter table public.client_pub_comments enable row level security;

-- Cualquier usuario autenticado del staff puede leer/marcar visto.
drop policy if exists cpc_select on public.client_pub_comments;
create policy cpc_select on public.client_pub_comments
  for select to authenticated using (true);

drop policy if exists cpc_update on public.client_pub_comments;
create policy cpc_update on public.client_pub_comments
  for update to authenticated using (true) with check (true);

-- El alta la hacemos por RPC (verifica token). No habilitamos insert directo.

-- ===== RPC: que el cliente reciba el calendario completo + comentarios previos =====
create or replace function public.jd_get_approval_payload(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
  v_pubs jsonb;
  v_comments jsonb;
begin
  select * into v_client from public.clients where approval_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'token invalido');
  end if;

  -- Todas las publicaciones del cliente (no solo las de revisión)
  select coalesce(jsonb_agg(p order by fecha_publicacion asc nulls last), '[]'::jsonb)
    into v_pubs
  from (
    select id, titulo, descripcion, copy, guion, red, tipo,
           fecha_publicacion, hashtags, asset_url, referencia_url,
           estado, notas_revision, cliente_revision_iniciada_at,
           publicacion_url, resubido_tiktok
    from public.publications
    where cliente_id = v_client.id
    order by fecha_publicacion asc nulls last
    limit 300
  ) p;

  -- Comentarios previos del cliente (para que vea lo que ya envió)
  select coalesce(jsonb_agg(c order by created_at desc), '[]'::jsonb)
    into v_comments
  from (
    select id, publication_id, contenido, created_at
    from public.client_pub_comments
    where cliente_id = v_client.id
    order by created_at desc
    limit 500
  ) c;

  return jsonb_build_object(
    'ok', true,
    'cliente', jsonb_build_object('id', v_client.id, 'nombre', v_client.nombre),
    'publicaciones', v_pubs,
    'comentarios', v_comments
  );
end;
$$;

grant execute on function public.jd_get_approval_payload(text) to anon, authenticated;

-- ===== RPC: agregar comentario del cliente a una pub =====
create or replace function public.jd_client_add_comment(
  p_token text,
  p_pub_id uuid,
  p_contenido text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_pub_client uuid;
  v_pub_titulo text;
  v_creador uuid;
  v_audiovisual uuid;
  v_cm uuid;
begin
  if length(coalesce(p_contenido, '')) < 1 then
    return jsonb_build_object('ok', false, 'error', 'comentario vacio');
  end if;
  if length(p_contenido) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'comentario muy largo');
  end if;

  select id into v_client_id from public.clients where approval_token = p_token;
  if v_client_id is null then
    return jsonb_build_object('ok', false, 'error', 'token invalido');
  end if;

  select cliente_id, titulo, creado_por_id, audiovisual_id
    into v_pub_client, v_pub_titulo, v_creador, v_audiovisual
  from public.publications where id = p_pub_id;

  if v_pub_client is null then
    return jsonb_build_object('ok', false, 'error', 'publicacion no encontrada');
  end if;
  if v_pub_client <> v_client_id then
    return jsonb_build_object('ok', false, 'error', 'publicacion no pertenece al cliente');
  end if;

  insert into public.client_pub_comments(publication_id, cliente_id, contenido)
  values (p_pub_id, v_client_id, p_contenido);

  -- Notificar al creador de la pub y al CM del cliente
  select cm_id into v_cm from public.clients where id = v_client_id;

  if v_creador is not null then
    insert into public.notifications(user_id, task_id, tipo, mensaje)
    select v_creador, null, 'comentario',
      'Cliente comentó: ' || coalesce(v_pub_titulo, 'pieza');
  end if;
  if v_cm is not null and v_cm <> coalesce(v_creador, '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notifications(user_id, task_id, tipo, mensaje)
    select v_cm, null, 'comentario',
      'Cliente comentó: ' || coalesce(v_pub_titulo, 'pieza');
  end if;
  if v_audiovisual is not null
     and v_audiovisual <> coalesce(v_creador, '00000000-0000-0000-0000-000000000000'::uuid)
     and v_audiovisual <> coalesce(v_cm, '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notifications(user_id, task_id, tipo, mensaje)
    select v_audiovisual, null, 'comentario',
      'Cliente comentó: ' || coalesce(v_pub_titulo, 'pieza');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.jd_client_add_comment(text, uuid, text) to anon, authenticated;
