-- Mejora: al cambiar el equipo de una cuenta (clients.disenador_id /
-- audiovisual_id / cm_id), las piezas TODAVÍA EN PRODUCCIÓN se reasignan al
-- nuevo responsable, según el tipo:
--   - post / carrusel → diseñador (publications.audiovisual_id)
--   - reel / video    → editor (audiovisual_id) + portada (disenador_id)
--   - historia        → CM (audiovisual_id)
--
-- Solo afecta piezas no finalizadas (NO toca las que están en revisión del
-- cliente, aprobadas o publicadas). Al cambiar publications.audiovisual_id, el
-- trigger 0110 reasigna sola la tarea vinculada. No reasigna si el nuevo
-- integrante quedó vacío (no pisa con null).
create or replace function public.jd_sync_client_team_to_pubs() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  -- Diseñador/a nuevo/a → diseño de post/carrusel + portada de reels.
  if new.disenador_id is distinct from old.disenador_id and new.disenador_id is not null then
    update public.publications
      set audiovisual_id = new.disenador_id
      where cliente_id = new.id
        and tipo in ('post', 'carrusel')
        and estado not in ('revision_cliente', 'aprobado', 'publicado')
        and audiovisual_id is distinct from new.disenador_id;
    update public.publications
      set disenador_id = new.disenador_id
      where cliente_id = new.id
        and tipo in ('reel', 'video')
        and estado not in ('revision_cliente', 'aprobado', 'publicado')
        and disenador_id is distinct from new.disenador_id;
  end if;

  -- Editor/a nuevo/a → edición de reel/video.
  if new.audiovisual_id is distinct from old.audiovisual_id and new.audiovisual_id is not null then
    update public.publications
      set audiovisual_id = new.audiovisual_id
      where cliente_id = new.id
        and tipo in ('reel', 'video')
        and estado not in ('revision_cliente', 'aprobado', 'publicado')
        and audiovisual_id is distinct from new.audiovisual_id;
  end if;

  -- CM nueva → historias.
  if new.cm_id is distinct from old.cm_id and new.cm_id is not null then
    update public.publications
      set audiovisual_id = new.cm_id
      where cliente_id = new.id
        and tipo = 'historia'
        and estado not in ('revision_cliente', 'aprobado', 'publicado')
        and audiovisual_id is distinct from new.cm_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.jd_sync_client_team_to_pubs() from anon, authenticated, public;

drop trigger if exists trg_clients_sync_team_to_pubs on public.clients;
create trigger trg_clients_sync_team_to_pubs
  after update of disenador_id, audiovisual_id, cm_id on public.clients
  for each row execute function public.jd_sync_client_team_to_pubs();
