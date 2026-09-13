// Congelado de los gastos en dólares de un mes YA CERRADO.
//
// El agujero que tapa: `fx.ts` congelaba un gasto al marcarlo pagado a mano,
// pero los gastos fijos los sella el cierre de mes (cron del día 1 y el botón
// del resumen), y ese camino solo escribía `fecha_pago` — el monto quedaba en
// USD. Resultado: los 24 gastos en dólares de julio, agosto y septiembre se
// seguían convirtiendo al dólar de HOY, así que **julio valía distinto cada día
// que se lo miraba** y la serie histórica del resumen y del informe no paraba
// de moverse. Es una de las razones por las que el dueño no le creía a los
// números.
//
// Ahora, al cerrar un mes, cada gasto en moneda extranjera se pasa a pesos con
// la cotización de ESE día y queda fijo para siempre. El monto original y el
// dólar usado quedan anotados en `notas` (mismo marcador que `fx.ts`), así que
// se puede auditar y revertir.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getExchangeRatesForDate, type ExchangeRates } from "@/lib/exchange";
import { freezeExpense } from "./fx";

export interface GastoACongelar {
  id: string;
  monto: number;
  moneda: string;
  notas: string | null;
  fecha_pago: string | null;
}

export interface ResultadoCongelado {
  congelados: number;
  /** Cuánto quedó fijado en pesos. */
  montoARS: number;
  /** Cotización usada por fecha, para poder explicarlo. */
  cotizaciones: Record<string, number>;
  errores: string[];
}

/**
 * Los que hay que tocar: pagados y todavía en moneda extranjera. Un gasto ya
 * pasado a ARS no se vuelve a tocar (por eso esto es idempotente), y uno sin
 * fecha de pago tampoco: mientras está pendiente es correcto que flote, porque
 * todavía no se sabe a qué dólar se va a pagar.
 */
export function gastosQueFaltaCongelar(gastos: GastoACongelar[]): GastoACongelar[] {
  return gastos.filter(
    (g) => !!g.fecha_pago && (g.moneda ?? "ARS") !== "ARS" && Number(g.monto) > 0
  );
}

/**
 * Congela en pesos los gastos en dólares ya pagados de un período.
 *
 * Cada gasto usa la cotización de SU fecha de pago, no una sola para todo el
 * mes: un gasto sellado el 12 y otro el 31 se pagaron a dólares distintos.
 *
 * `ratesHoy` es el paracaídas: si la API de histórico no contesta, se usa el
 * dólar de hoy antes que dejar el gasto flotando para siempre. Queda anotado
 * igual, así que después se puede corregir.
 */
export async function congelarGastosDelPeriodo(
  admin: SupabaseClient,
  periodo: string,
  ratesHoy: ExchangeRates
): Promise<ResultadoCongelado> {
  const errores: string[] = [];
  const { data, error } = await admin
    .from("expenses")
    .select("id, monto, moneda, notas, fecha_pago")
    .eq("periodo", periodo)
    .not("fecha_pago", "is", null)
    .neq("moneda", "ARS");
  if (error) return { congelados: 0, montoARS: 0, cotizaciones: {}, errores: [error.message] };

  const pendientes = gastosQueFaltaCongelar((data ?? []) as GastoACongelar[]);
  if (pendientes.length === 0)
    return { congelados: 0, montoARS: 0, cotizaciones: {}, errores };

  // Una sola consulta por fecha distinta, no una por gasto.
  const fechas = [...new Set(pendientes.map((g) => g.fecha_pago!))];
  const porFecha = new Map<string, ExchangeRates>();
  const cotizaciones: Record<string, number> = {};
  for (const f of fechas) {
    const hist = await getExchangeRatesForDate(f);
    if (hist) {
      porFecha.set(f, { ...ratesHoy, USD: hist.USD, USDC: hist.USDC, source: "live" });
      cotizaciones[f] = hist.USDC;
    } else {
      errores.push(`sin cotización histórica para ${f}: se usó el dólar de hoy`);
      porFecha.set(f, ratesHoy);
      cotizaciones[f] = ratesHoy.USDC;
    }
  }

  let congelados = 0;
  let montoARS = 0;
  for (const g of pendientes) {
    const rates = porFecha.get(g.fecha_pago!)!;
    const frozen = freezeExpense(Number(g.monto), g.moneda, g.notas, rates, g.fecha_pago!);
    if (!frozen) continue;
    const { error: upErr } = await admin
      .from("expenses")
      .update({ monto: frozen.montoARS, moneda: "ARS", notas: frozen.notas })
      .eq("id", g.id);
    if (upErr) {
      errores.push(`${g.id}: ${upErr.message}`);
      continue;
    }
    congelados += 1;
    montoARS += frozen.montoARS;
  }

  return { congelados, montoARS, cotizaciones, errores };
}
