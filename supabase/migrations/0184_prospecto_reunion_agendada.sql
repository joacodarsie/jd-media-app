-- Reunión agendada con un prospecto (24/9/2026, pedido del dueño).
--
-- Hasta ahora "reunión" era solo un estado, sellado con `reunion_at` (CUÁNDO
-- se agendó, para medir el embudo por semana). Faltaba CUÁNDO es: sin eso no
-- hay aviso ni calendario. Al pasar un contacto a reunión ahora se pide día y
-- hora, se crea la reunión en la Agenda (internal_meetings) y se avisa a quien
-- contacta y al director, en la plataforma y en el celular.
--
--  · reunion_fecha       — día y hora de la reunión.
--  · reunion_meeting_id  — la reunión de la Agenda, para reprogramarla sin duplicar.

alter table public.prospecting_contacts
  add column if not exists reunion_fecha timestamptz,
  add column if not exists reunion_meeting_id uuid references public.internal_meetings(id) on delete set null;
