-- Registro de "a quién ya le escribí" para la pantalla Conseguir clientes.
--
-- Sin esto la lista del día no sabe a quién ya le pediste un referido y te lo
-- vuelve a ofrecer mañana. Es la única fila que hay que cargar, y se carga con
-- un clic al mandar el mensaje — no hay formulario.

create table if not exists public.outreach_log (
  id            uuid primary key default gen_random_uuid(),
  -- referido | reactivacion
  tipo          text not null,
  -- A quién: cliente (activo o perdido). Sin FK dura para que borrar un cliente
  -- no borre la historia de lo que se hizo.
  target_id     uuid not null,
  target_nombre text not null,
  -- pedido | respondio | dio_referido | no | cerrado
  resultado     text not null default 'pedido',
  notas         text,
  user_id       uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_outreach_log_target
  on public.outreach_log (tipo, target_id, created_at desc);

alter table public.outreach_log enable row level security;

drop policy if exists outreach_log_rw on public.outreach_log;
create policy outreach_log_rw on public.outreach_log
  for all to authenticated
  using (public.jd_is_staff() or public.jd_has_role(array['comercial','prospecting']))
  with check (public.jd_is_staff() or public.jd_has_role(array['comercial','prospecting']));

insert into public.review_flags (ruta, label, nota)
values (
  '/captacion',
  'Conseguir clientes: la lista del día',
  'Pantalla nueva. Junta los 3 canales gratis: pedir referidos a los 17 clientes activos, reactivar las cuentas perdidas y los contactos cargados sin contactar. Probar: que el mensaje salga con el nombre correcto, que el botón de WhatsApp abra el chat, y que al marcar "Ya le escribí" la fila desaparezca de la lista de hoy y no vuelva mañana.'
);
