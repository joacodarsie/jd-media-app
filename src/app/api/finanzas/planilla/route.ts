import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { planillaAutorizada } from "@/lib/finanzas/planilla-auth";
import { getExchangeRates } from "@/lib/exchange";
import { toARS } from "@/lib/finanzas";
import { armarDatos, periodoPorDefecto } from "@/lib/finanzas/informe-run";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import {
  clientesPlanilla,
  deudasPlanilla,
  facturadoPorPeriodo,
  facturadoUltimos12,
  mesesPlanilla,
  periodoAnterior,
  sueldosPlanilla,
  type Planilla,
} from "@/lib/finanzas/planilla";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Los números de la agencia para la planilla personal del dueño
 * ("Finanzas de Joaquín"). La pide su Apps Script una vez por día.
 *
 * Va con token (ver lib/finanzas/planilla-auth). Sin la migración 0227
 * aplicada, contesta 503 y la planilla sigue como estaba.
 */
export async function GET(req: NextRequest) {
  const ok = await planillaAutorizada(req);
  if (ok === null) {
    return NextResponse.json({ error: "Falta configurar la clave de la planilla (migración 0227)" }, { status: 503 });
  }
  if (!ok) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const m = req.nextUrl.searchParams.get("m");
  const periodo = m && /^\d{4}-\d{2}$/.test(m) ? m : periodoPorDefecto();

  try {
    const db = createAdmin();
    const anterior = periodoAnterior(periodo);
    const [datos, { data: invs }, rates, nominaAnterior] = await Promise.all([
      armarDatos(db, periodo),
      db.from("client_invoices").select("periodo, monto, moneda"),
      getExchangeRates(),
      // El mes recién cerrado se le paga al equipo el 7: hasta entonces, la calculada.
      buildPeriodPayroll(db, anterior),
    ]);
    const facturado = facturadoPorPeriodo(
      ((invs ?? []) as { periodo: string; monto: number; moneda: string | null }[]).map((i) => ({
        periodo: i.periodo,
        montoARS: toARS(Number(i.monto) || 0, i.moneda ?? "ARS", rates),
      })),
    );

    const nominaDelMes = Math.round(datos.desglose.reduce((a, p) => a + (p.total || 0), 0));
    const nominaCalculada = new Map([
      [anterior, Math.round(nominaAnterior.totalNomina || 0)],
      [periodo, nominaDelMes],
    ]);

    const planilla: Planilla = {
      generadoEl: datos.generadoEl,
      periodo,
      dolar: datos.dolar,
      meses: mesesPlanilla(datos.serie, facturado, nominaCalculada),
      clientes: clientesPlanilla(datos.clientes),
      nominaDelMes,
      porCobrar: deudasPlanilla(datos.cobros),
      facturado12m: facturadoUltimos12(facturado, periodo),
      sueldos: { periodo: anterior, personas: sueldosPlanilla(nominaAnterior.people) },
    };
    return NextResponse.json(planilla, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudieron armar los datos" },
      { status: 500 },
    );
  }
}
