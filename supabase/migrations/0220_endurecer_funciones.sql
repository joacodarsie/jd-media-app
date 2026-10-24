-- Revisión general (24/10/2026): lo que marcó el linter de Supabase.
--
-- 1) Siete funciones sin search_path fijo: se fija en public.
-- 2) Funciones que nadie sin sesión necesita llamar: se les saca el EXECUTE al
--    rol anónimo. (Las dos que generan facturas y pagos ya chequeaban staff por
--    dentro; igual no tienen por qué estar expuestas.) Las que usan las
--    políticas de RLS (jd_role, jd_is_staff…) y las del portal del cliente
--    (jd_client_*, por token) quedan como están.
-- 3) Índices para las relaciones que más se consultan.

alter function public.next_diagnostic_version(uuid) set search_path = public;
alter function public.tasks_un_solo_nivel() set search_path = public;
alter function public.team_chat_unread_count(uuid) set search_path = public;
alter function public.touch_freelance_contracts() set search_path = public;
alter function public.touch_google_calendar_connections() set search_path = public;
alter function public.touch_internal_meetings() set search_path = public;
alter function public.trigger_notify_team_mention() set search_path = public;

revoke execute on function public.jd_generate_invoices_for_period(text) from anon, public;
revoke execute on function public.jd_generate_payments_for_period(text) from anon, public;
revoke execute on function public.team_chat_unread_count(uuid) from anon, public;
grant execute on function public.jd_generate_invoices_for_period(text) to authenticated, service_role;
grant execute on function public.jd_generate_payments_for_period(text) to authenticated, service_role;
grant execute on function public.team_chat_unread_count(uuid) to authenticated, service_role;

create index if not exists idx_task_history_user on public.task_history(user_id);
create index if not exists idx_prospecting_contacts_asignado on public.prospecting_contacts(asignado_a);
create index if not exists idx_prospecting_contacts_contactado_por on public.prospecting_contacts(contactado_por);
create index if not exists idx_clients_responsable on public.clients(responsable_id);
create index if not exists idx_tasks_bloqueo_esperando on public.tasks(bloqueo_esperando_id);
