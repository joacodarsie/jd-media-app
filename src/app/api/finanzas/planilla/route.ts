import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { getExchangeRates } from "@/lib/exchange";
import { toARS } from "@/lib/finanzas";
import { armarDatos, periodoPorDefecto } from "@/lib/finanzas/informe-run";
import {
  clientesPlanilla,
  deudasPlanilla,
  facturadoPorPeriodo,
  facturadoUltimos12,
  mesesPlanilla,
  type Planilla,
} from "@/lib/finanzas/planilla";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Los números de la agencia para la planilla personal del dueño
 * ("Finanzas de Joaquín"). La pide su Apps Script una vez por día.
 *
 * Va con token porque es toda la información financiera de la agencia. El
 * token no está en Vercel: se compara su sha256 con el de `claves_api` (0227).
 * Sin la migración aplicada, contesta 503 y la planilla sigue como estaba.
 */
async function autorizado(token: string): Promise<boolean | null> {
  const { data, error } = await createAdmin()
    .from("claves_api")
    .select("sha256")
    .eq("nombre", "planilla_finanzas")
    .maybeSingle();
  if (error || !data) return null;
  const esperado = Buffer.from(String((data as { sha256: string }).sha256), "hex");
  const recibido = createHash("sha256").update(token).digest();
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-planilla-token") ?? req.nextUrl.searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const ok = await autorizado(token);
  if (ok === null) {
    return NextResponse.json({ error: "Falta configurar la clave de la planilla (migración 0227)" }, { status: 503 });
  }
  if (!ok) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const m = req.nextUrl.searchParams.get("m");
  const periodo = m && /^\d{4}-\d{2}$/.test(m) ? m : periodoPorDefecto();

  try {
    const db = createAdmin();
    const [datos, { data: invs }, rates] = await Promise.all([
      armarDatos(db, periodo),
      db.from("client_invoices").select("periodo, monto, moneda"),
      getExchangeRates(),
    ]);
    const facturado = facturadoPorPeriodo(
      ((invs ?? []) as { periodo: string; monto: number; moneda: string | null }[]).map((i) => ({
        periodo: i.periodo,
        montoARS: toARS(Number(i.monto) || 0, i.moneda ?? "ARS", rates),
      })),
    );

    const planilla: Planilla = {
      generadoEl: datos.generadoEl,
      periodo,
      dolar: datos.dolar,
      meses: mesesPlanilla(datos.serie, facturado),
      clientes: clientesPlanilla(datos.clientes),
      nominaDelMes: Math.round(datos.desglose.reduce((a, p) => a + (p.total || 0), 0)),
      porCobrar: deudasPlanilla(datos.cobros),
      facturado12m: facturadoUltimos12(facturado, periodo),
    };
    return NextResponse.json(planilla, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudieron armar los datos" },
      { status: 500 },
    );
  }
}
