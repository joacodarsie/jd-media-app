-- Etapa 6: calendario de contenidos por cliente
do $$ begin
  create type publication_status as enum (
    'idea','en_diseno','guion','edicion',
    'revision_creativa','revision_cliente',
    'aprobado','publicado','rechazado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type publication_network as enum (
    'instagram','tiktok','facebook','linkedin','youtube','twitter','otra'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type publication_type as enum (
    'post','reel','carrusel','historia','video','otro'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.publications (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.clients(id) on delete cascade,
  titulo            text not null,
  copy              text,
  guion             text,
  red               publication_network not null default 'instagram',
  tipo              publication_type not null default 'post',
  fecha_publicacion timestamptz,
  hashtags          text,
  asset_url         text,
  referencia_url    text,
  creado_por_id     uuid references public.users(id) on delete set null,
  audiovisual_id    uuid references public.users(id) on delete set null,
  estado            publication_status not null default 'idea',
  task_id           uuid references public.tasks(id) on delete set null,
  notas_revision    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_publications_cliente_fecha
  on public.publications(cliente_id, fecha_publicacion);
create index if not exists idx_publications_estado on public.publications(estado);
create index if not exists idx_publications_audiovisual on public.publications(audiovisual_id);
create index if not exists idx_publications_creador on public.publications(creado_por_id);
create index if not exists idx_publications_task on public.publications(task_id);

drop trigger if exists trg_publications_updated on public.publications;
create trigger trg_publications_updated before update on public.publications
  for each row execute function public.set_updated_at();

alter table public.publications enable row level security;

drop policy if exists publications_select on public.publications;
create policy publications_select on public.publications
  for select to authenticated using (true);

drop policy if exists publications_insert on public.publications;
create policy publications_insert on public.publications
  for insert to authenticated
  with check (creado_por_id = (select auth.uid()));

drop policy if exists publications_update on public.publications;
create policy publications_update on public.publications
  for update to authenticated
  using (
    public.jd_is_staff()
    or creado_por_id = (select auth.uid())
    or audiovisual_id = (select auth.uid())
  )
  with check (
    public.jd_is_staff()
    or creado_por_id = (select auth.uid())
    or audiovisual_id = (select auth.uid())
  );

drop policy if exists publications_delete on public.publications;
create policy publications_delete on public.publications
  for delete to authenticated
  using (public.jd_is_staff() or creado_por_id = (select auth.uid()));

create or replace function public.notify_publication_review() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_coord_id uuid;
  v_title text;
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;

  v_title := coalesce(new.titulo, 'sin título');

  if new.estado = 'edicion' and new.audiovisual_id is not null
     and new.audiovisual_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notifications(user_id, task_id, tipo, mensaje)
    values (new.audiovisual_id, new.task_id, 'asignacion',
            'Te asignaron edición: ' || v_title);
  end if;

  if new.estado = 'revision_creativa' then
    for v_coord_id in
      select id from public.users
      where rol = 'coordinador' and activo = true
        and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    loop
      insert into public.notifications(user_id, task_id, tipo, mensaje)
      values (v_coord_id, new.task_id, 'asignacion',
              'Revisión creativa: ' || v_title);
    end loop;
  end if;

  if new.estado in ('aprobado','rechazado') and new.creado_por_id is not null
     and new.creado_por_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notifications(user_id, task_id, tipo, mensaje)
    values (new.creado_por_id, new.task_id, 'asignacion',
            (case when new.estado='aprobado' then 'Aprobada: ' else 'Cambios pedidos: ' end) || v_title);
  end if;

  return new;
end;
$$;

revoke execute on function public.notify_publication_review() from anon, authenticated, public;

drop trigger if exists trg_publications_notify on public.publications;
create trigger trg_publications_notify
  after insert or update of estado on public.publications
  for each row execute function public.notify_publication_review();
