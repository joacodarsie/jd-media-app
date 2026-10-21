-- Comercial (21/10/2026, pedido del dueño):
-- 1) Matías Castello NO tiene fijo mensual: solo variable. El fijo de prospección
--    queda para quien lo tenga acordado (Santi). Por persona, no por rol.
-- 2) Una cuenta la pueden cerrar DOS comerciales: cada uno cobra la mitad de la
--    comisión de cierre y de la cartera.
alter table public.users add column if not exists comercial_sin_fijo boolean not null default false;
alter table public.clients add column if not exists cerrado_con_id uuid references public.users(id) on delete set null;

update public.users set comercial_sin_fijo = true where id = 'b9ff8c71-7057-407b-baf7-1171048a9952'; -- Matías Castello
