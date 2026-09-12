import type { SupabaseClient } from "@supabase/supabase-js";
import { hoyYmd } from "@/lib/dates";
import { getExchangeRates } from "@/lib/exchange";
import { toARS } from "@/lib/finanzas";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import { generateFixedExpensesForPeriod } from "./fixed-expenses";
import { planDeCierre, fechaDeCierre, type GastoFijoPendiente } from "./cierre-mes";

/**
 * El que escribe en la base lo que `cierre-mes.ts` decidió.
 *
 * Se usa desde dos lados: el botón del resumen (que sella sueldos Y gastos
 * fijos, porque el dueño está confirmando que pagó todo) y el cron del día 1
 * (que sella SOLO los gastos fijos, porque los débitos automáticos se pagan
 * solos y los sueldos no).
 *
 * Los gastos fijos del mes los genera `fixed-expenses.ts` desde las
 * suscripciones activas; acá se generan si faltan y después se marcan pagados,
 * que era el paso que nunca ocurría.
 */

export interface ResultadoCierre {
  periodo: string;
  fecha: string;
  /** Cuántas personas quedaron con el sueldo registrado como pagado. */
  personas: number;
  montoEquipo: number;
  /** Cuántos gastos fijos se generaron porque faltaban. */
  gastosGenerados: number;
  /** Cuántos quedaron marcados como pagados, y por cuánto en pesos. */
  gastosMarcados: number;
  montoGastos: number;
  nadaQueHacer: boolean;
  errores: string[];
}

/**
 * Registra el mes como pagado.
 *
 * `incluirSueldos: false` deja los sueldos en paz — es el modo del cron, que no
 * puede afirmar que el dueño le transfirió a nadie.
 *
 * Es idempotente: correrlo dos veces no duplica nada. Los gastos se generan por
 * concepto+período y los sueldos van por el unique (user_id, periodo, concepto).
 */
export async function cerrarMes(
  admin: SupabaseClient,
  periodo: string,
  opts: { incluirSueldos: boolean; creadoPorId?: string | null }
): Promise<ResultadoCierre> {
  const fecha = fechaDeCierre(periodo, hoyYmd());
  const errores: string[] = [];

  // 1. Que existan los gastos fijos del mes. Si el mes es viejo y nunca se
  //    generaron, se generan ahora: son las mismas suscripciones de siempre.
  let gastosGenerados = 0;
  try {
    const gen = await generateFixedExpensesForPeriod(admin, periodo, opts.creadoPorId ?? null);
    gastosGenerados = gen.creados;
  } catch (e) {
    errores.push(`generar gastos: ${e instanceof Error ? e.message : String(e)}`);
  }

  const [payroll, { data: pendientesRaw }, rates] = await Promise.all([
    opts.incluirSueldos ? buildPeriodPayroll(admin, periodo) : Promise.resolve(null),
    admin
      .from("expenses")
      .select("id, concepto, monto, moneda")
      .eq("periodo", periodo)
      .eq("recurrente", true)
      .is("fecha_pago", null),
    getExchangeRates(),
  ]);

  const gastosPendientes: GastoFijoPendiente[] = (
    (pendientesRaw ?? []) as { id: string; concepto: string; monto: number; moneda: string }[]
  ).map((g) => ({
    id: g.id,
    concepto: g.concepto,
    montoARS: toARS(Number(g.monto) || 0, g.moneda ?? "ARS", rates),
  }));

  const plan = planDeCierre({
    personas: (payroll?.people ?? []).map((p) => ({
      userId: p.userId,
      nombre: p.nombre,
      total: p.total,
      registrado: p.registrado,
      montoPagado: p.montoPagado,
      fechaPago: p.fechaPago,
    })),
    gastosPendientes,
  });

  // 2. Sueldos.
  let personas = 0;
  if (payroll && plan.pagos.length > 0) {
    const filas = plan.pagos.map((p) => ({
      user_id: p.userId,
      periodo,
      concepto: payroll.salaryConcepto,
      monto: p.monto,
      moneda: "ARS",
      fecha_programada: fecha,
      fecha_pago: fecha,
      creado_por_id: opts.creadoPorId ?? null,
    }));
    const { error } = await admin
      .from("team_payments")
      .upsert(filas, { onConflict: "user_id,periodo,concepto" });
    if (error) errores.push(`sueldos: ${error.message}`);
    else personas = filas.length;
  }

  // 3. Sellar los gastos fijos. Este es el paso que faltaba.
  let gastosMarcados = 0;
  if (plan.gastosIds.length > 0) {
    const { error } = await admin
      .from("expenses")
      .update({ fecha_pago: fecha })
      .in("id", plan.gastosIds);
    if (error) errores.push(`gastos: ${error.message}`);
    else gastosMarcados = plan.gastosIds.length;
  }

  return {
    periodo,
    fecha,
    personas,
    montoEquipo: personas > 0 ? plan.totalEquipo : 0,
    gastosGenerados,
    gastosMarcados,
    montoGastos: gastosMarcados > 0 ? plan.totalGastos : 0,
    nadaQueHacer: personas === 0 && gastosMarcados === 0,
    errores,
  };
}
