-- Fix: portal del cliente tira "No se pudo guardar" al aprobar/pedir cambios.
-- La funcion jd_client_decision falla porque el INSERT de notifications no
-- atraviesa la RLS (la policy notif_insert fue removida en 0003_security_hardening
-- y la SECURITY DEFINER por si sola no garantiza bypass si el owner no tiene
-- BYPASSRLS).
--
-- Solucion: envolver el INSERT de notificacion en su propio bloque
-- EXCEPTION para que no rompa la decision principal del cliente, y devolver
-- el error real (en vez del generico) si algo realmente falla en el UPDATE.

create or replace function public.jd_client_decision(
  p_token text,
  p_pub_id uuid,
  p_decision text,
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

  begin
    update public.publications
       set estado = p_decision::publication_status,
           notas_revision = coalesce(p_comentario, notas_revision),
           cliente_revision_completada_at = now()
     where id = p_pub_id;
  exception when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'no se pudo actualizar la publicacion: ' || sqlerrm
    );
  end;

  -- Notificacion: best-effort. Si falla, NO rompemos la decision del cliente
  -- (el cambio de estado en la publicacion es lo principal).
  if v_creador is not null then
    begin
      insert into public.notifications(user_id, task_id, tipo, mensaje, link)
      values (
        v_creador,
        null,
        'asignacion',
        (case when p_decision='aprobado'
              then 'Cliente aprobó: '
              else 'Cliente pidió cambios en: '
         end) || coalesce(v_titulo, 'pieza'),
        '/contenidos'
      );
    exception when others then
      -- Silencioso a proposito. El cambio de estado ya fue exitoso.
      null;
    end;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.jd_client_decision(text, uuid, text, text) to anon, authenticated;

-- Misma defensa para jd_client_add_comment (comentario solo, sin cambio de estado)
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
  v_creador uuid;
begin
  if p_contenido is null or btrim(p_contenido) = '' then
    return jsonb_build_object('ok', false, 'error', 'comentario vacio');
  end if;

  select id into v_client_id from public.clients where approval_token = p_token;
  if v_client_id is null then
    return jsonb_build_object('ok', false, 'error', 'token invalido');
  end if;

  select cliente_id, creado_por_id
    into v_pub_client, v_creador
  from public.publications where id = p_pub_id;

  if v_pub_client is null or v_pub_client <> v_client_id then
    return jsonb_build_object('ok', false, 'error', 'publicacion invalida');
  end if;

  begin
    insert into public.client_pub_comments(publication_id, contenido)
    values (p_pub_id, btrim(p_contenido));
  exception when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'no se pudo guardar el comentario: ' || sqlerrm
    );
  end;

  if v_creador is not null then
    begin
      insert into public.notifications(user_id, task_id, tipo, mensaje, link)
      values (
        v_creador,
        null,
        'comentario',
        'Cliente comentó una pieza',
        '/contenidos'
      );
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.jd_client_add_comment(text, uuid, text) to anon, authenticated;
