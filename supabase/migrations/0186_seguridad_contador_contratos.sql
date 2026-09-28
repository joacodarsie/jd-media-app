-- Seguridad (28/9/2026): el único aviso de nivel ERROR del linter de Supabase.
--
-- `contract_counters` (el número correlativo de cada carta acuerdo) estaba sin
-- RLS: cualquiera con la anon key podía leerlo o pisarlo por la API. Solo lo
-- usa `next_contract_number`, que se llama desde el server con el service role
-- (onboarding/actions.ts), y el service role no pasa por RLS: activarla sin
-- políticas cierra el acceso público sin romper la numeración.
--
-- De paso, las funciones que tocan este tipo de tablas quedan con search_path
-- fijo (aviso "Function Search Path Mutable").

alter table public.contract_counters enable row level security;

alter function public.next_contract_number(integer) set search_path = public;
revoke execute on function public.next_contract_number(integer) from anon, authenticated;
