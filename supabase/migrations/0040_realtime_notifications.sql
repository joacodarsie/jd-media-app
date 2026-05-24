-- Agregar notifications a la publication de Realtime para suscripciones en el client.

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
