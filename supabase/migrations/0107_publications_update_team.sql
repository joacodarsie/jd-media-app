-- Fix: al cambiar el estado de una pieza en el calendario, a quien NO era
-- staff (admin/coordinador), creador o el audiovisual_id, el UPDATE le afectaba
-- 0 filas por RLS → la app tiraba "Cannot coerce the result to a single JSON
-- object". Pasaba, por ejemplo, con la diseñadora avanzando el estado de una
-- pieza de su cuenta, o un CM (que NO cuenta como jd_is_staff).
--
-- Ahora puede actualizar una publicación cualquier integrante del EQUIPO de la
-- cuenta (CM, diseño, audiovisual, coordinación, media buyer), además del staff,
-- el creador, el responsable de la pieza (audiovisual_id) y el diseñador de la
-- portada (disenador_id). Los edits "fuertes" del calendario siguen gateados a
-- nivel app (solo admin/coordinación/CM); esto habilita avanzar el estado.
drop policy if exists publications_update on public.publications;
create policy publications_update on public.publications
  for update to authenticated
  using (
    public.jd_is_staff()
    or creado_por_id = (select auth.uid())
    or audiovisual_id = (select auth.uid())
    or disenador_id = (select auth.uid())
    or exists (
      select 1 from public.clients c
      where c.id = publications.cliente_id
        and (select auth.uid()) in (
          c.cm_id, c.disenador_id, c.audiovisual_id, c.coordinador_id, c.media_buyer_id
        )
    )
  )
  with check (
    public.jd_is_staff()
    or creado_por_id = (select auth.uid())
    or audiovisual_id = (select auth.uid())
    or disenador_id = (select auth.uid())
    or exists (
      select 1 from public.clients c
      where c.id = publications.cliente_id
        and (select auth.uid()) in (
          c.cm_id, c.disenador_id, c.audiovisual_id, c.coordinador_id, c.media_buyer_id
        )
    )
  );
