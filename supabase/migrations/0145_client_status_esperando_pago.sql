-- Estado nuevo: "esperando_pago".
--
-- Problema real: para generar la carta acuerdo hay que marcar la cuenta como
-- cliente, así que cuentas que todavía NO pagaron figuran como activas. Filí y
-- Asociados es el caso: activo desde el 15/07 y nunca pagó. Eso infla la
-- facturación, el conteo de clientes y las métricas de la meta.
--
-- Con este estado la cuenta existe (se le puede hacer la carta, el onboarding y
-- el portal) pero NO cuenta como cliente hasta que se marque el pago. Al marcar
-- "Me pagó" en /cobros, pasa sola a 'activo'.

alter type public.client_status add value if not exists 'esperando_pago';
