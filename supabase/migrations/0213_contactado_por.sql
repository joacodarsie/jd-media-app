-- Prospección (21/10/2026): quién lo marcó DE VERDAD. Los mails en frío
-- automáticos sellan contactado_at sin persona; cuando después un comercial le
-- escribía y lo marcaba, no se le contaba (la fecha ya estaba) o le sumaba al
-- que lo tenía pre-asignado. contactado_por = la primera PERSONA que lo marcó.
alter table public.prospecting_contacts add column if not exists contactado_por uuid references public.users(id) on delete set null;
update public.prospecting_contacts set contactado_por = asignado_a
  where contactado_por is null and asignado_a is not null and estado <> 'nuevo' and contactado_at is not null;
