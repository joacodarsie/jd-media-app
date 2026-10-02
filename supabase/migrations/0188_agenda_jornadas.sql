-- Jornadas de producción en la Agenda (pedido de Luz, 2/10/2026).
--
-- Nadie cargaba las jornadas en /coordinacion/jornadas después de hacerlas, así
-- que se agendan en la Agenda como un tipo más de evento. Al agendar una
-- jornada se crea su registro en production_sessions (el que usa Sueldos), y
-- queda enlazado para que moverla, editarla o borrarla lo mantenga al día.

alter table public.internal_meetings
  add column if not exists tipo text not null default 'reunion';

do $$ begin
  alter table public.internal_meetings
    add constraint internal_meetings_tipo_check check (tipo in ('reunion', 'jornada'));
exception when duplicate_object then null; end $$;

alter table public.internal_meetings
  add column if not exists production_session_id uuid
    references public.production_sessions(id) on delete set null;
