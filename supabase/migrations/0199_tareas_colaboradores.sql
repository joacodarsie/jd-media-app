-- Tareas con más de una persona (pedido del dueño, 13/10/2026).
--
-- El responsable sigue siendo uno (`asignado_a_id`: el que responde por la
-- tarea, el que cuenta en métricas y vencidas). Se suman `colaboradores`: los
-- que también la hacen. La ven en «Mis tareas» y en su día, la pueden mover y
-- les llega el aviso cuando los suman.

alter table public.tasks add column if not exists colaboradores uuid[] not null default '{}';
create index if not exists idx_tasks_colaboradores on public.tasks using gin (colaboradores);

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (
  jd_is_staff()
  or asignado_a_id = (select auth.uid())
  or (select auth.uid()) = any (colaboradores)
  or creado_por_id = (select auth.uid())
  or aprobador_id = (select auth.uid())
  or area = jd_area()
  or cliente_id in (select clients.id from clients where clients.creativa_asignada_id = (select auth.uid()))
);

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update using (
  jd_is_staff()
  or asignado_a_id = (select auth.uid())
  or (select auth.uid()) = any (colaboradores)
  or creado_por_id = (select auth.uid())
  or aprobador_id = (select auth.uid())
  or area = jd_area()
  or cliente_id in (select clients.id from clients where clients.creativa_asignada_id = (select auth.uid()))
) with check (
  jd_is_staff()
  or asignado_a_id = (select auth.uid())
  or (select auth.uid()) = any (colaboradores)
  or creado_por_id = (select auth.uid())
  or aprobador_id = (select auth.uid())
  or area = jd_area()
  or cliente_id in (select clients.id from clients where clients.creativa_asignada_id = (select auth.uid()))
);

-- Aviso a los que se suman (no al que hizo el cambio ni al responsable, que ya
-- tiene su propio aviso).
create or replace function public.notify_task_colaboradores()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_fecha text;
  v_uid uuid;
begin
  if coalesce(array_length(new.colaboradores, 1), 0) = 0 then return new; end if;
  v_fecha := case when new.fecha_limite is null then 'sin fecha' else to_char(new.fecha_limite, 'DD/MM') end;
  foreach v_uid in array new.colaboradores loop
    continue when v_uid = v_me or v_uid is not distinct from new.asignado_a_id;
    continue when tg_op = 'UPDATE' and v_uid = any (coalesce(old.colaboradores, '{}'));
    begin
      insert into public.notifications (user_id, task_id, tipo, mensaje, link)
      values (
        v_uid,
        new.id,
        'asignacion'::notification_type,
        'Te sumaron a: ' || coalesce(new.titulo, 'una tarea') || ' · entrega ' || v_fecha,
        '/tareas/' || new.id::text
      );
    exception when others then
      null;
    end;
  end loop;
  return new;
end $$;

drop trigger if exists trg_task_colaboradores on public.tasks;
create trigger trg_task_colaboradores
  after insert or update of colaboradores on public.tasks
  for each row execute function public.notify_task_colaboradores();
