-- Recordatorios de cobro: mensaje editado a mano y cuáles NO hay que mandar.
--
-- Dos problemas reales del mes a mes:
--  1. El mensaje se podía editar pero el cambio vivía solo en el navegador: al
--     recargar volvía el texto generado y había que editarlo de nuevo.
--  2. La lista trae a TODAS las cuentas activas, pero siempre hay alguna a la
--     que no corresponde escribirle este mes (ya pagó por otro lado, está
--     pausada, es un caso especial). No había forma de sacarla y se mandaban
--     recordatorios de más.
--
-- Ambas cosas son POR PERÍODO: el mes que viene la lista vuelve a estar limpia.

create table if not exists public.payment_reminder_overrides (
  periodo     text not null,             -- YYYY-MM
  -- Identifica al destinatario: los ids de las cuentas del grupo unidos con "-"
  -- (un titular puede tener varias marcas y recibe un solo mensaje).
  grupo_key   text not null,
  mensaje     text,
  oculto      boolean not null default false,
  updated_by  uuid references public.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (periodo, grupo_key)
);

alter table public.payment_reminder_overrides enable row level security;

drop policy if exists payment_reminder_overrides_rw on public.payment_reminder_overrides;
create policy payment_reminder_overrides_rw on public.payment_reminder_overrides
  for all to authenticated
  using (public.jd_is_staff())
  with check (public.jd_is_staff());

insert into public.review_flags (ruta, label, nota)
values (
  '/finanzas/cobros',
  'Recordatorios: editar, guardar y sacar de la lista',
  'Probar: (1) editar el mensaje de un recordatorio, apretar Listo y RECARGAR la página — el texto editado tiene que seguir ahí; (2) "Sacar de la lista" esconde ese recordatorio del mes y se puede volver a mostrar; (3) "Ya cobré" marca las facturas de esas cuentas como cobradas. Todo es por mes: en agosto la lista vuelve a estar completa.'
);
