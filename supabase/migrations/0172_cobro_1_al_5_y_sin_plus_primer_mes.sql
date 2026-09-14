-- Dos decisiones del dueño del 15/9/2026.
--
-- 1) LOS CLIENTES PAGAN DEL 1 AL 5. Con los sueldos del equipo el día 7, la
--    ventana de cobro vuelve al mes que se abona (antes iba del 25 del mes
--    anterior al 1º). El código ya lee la política nueva de
--    lib/finanzas/ciclo-cobro.ts; acá solo se corren al día 5 los vencimientos
--    de las facturas que todavía no se cobraron, para que no figuren vencidas
--    del 2 al 5 cuando no lo están.
--
-- 2) SIN PLUS DEL PRIMER MES para la CM y el media buyer. Con dos semanas de
--    puesta en marcha, el arranque entra en los tiempos normales del equipo. La
--    nómina lo sigue mostrando hasta septiembre de 2026 (lo que efectivamente
--    se pagó) y desde octubre no existe.

update public.client_invoices
set fecha_vencimiento = (periodo || '-05')::date
where fecha_cobro is null
  and periodo >= '2026-09'
  and fecha_vencimiento = (periodo || '-01')::date;

update public.agency_settings
set rates = coalesce(rates, '{}'::jsonb) || jsonb_build_object('plus_primer_mes', 0)
where id = 1;
