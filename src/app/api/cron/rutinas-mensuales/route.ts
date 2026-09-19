import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod } from "@/lib/finanzas";
import { runRutinasMensuales } from "@/lib/tareas/rutinas-mensuales-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Las tareas de todos los meses — corre el día 1.
 *
 * Crea las tres que se repiten siempre: cobrarles a los clientes (día 5),
 * cerrar el mes anterior (día 5) y pagar los sueldos (día 7). Al insertarlas,
 * el trigger de asignación le avisa a cada responsable, así que nadie tiene que
 * acordarse de nada.
 *
 * La reunión mensual de cada cuenta NO se crea acá: la genera el cron diario
 * (`lib/retencion/reunion-mensual`), que además escala al dueño las que no se
 * dieron pasado el 15.
 *
 * El cron diario también lo llama, por si este no llegara a correr: es
 * idempotente (`tasks.rutina_key` es único, migración 0181).
 *
 * Autenticación: Bearer CRON_SECRET, o header x-cron-secret.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const alt = req.headers.get("x-cron-secret");
    if (auth !== `Bearer ${secret}` && alt !== secret) {
      return NextResponse.json({ error: "no autorizado" }, { status: 401 });
    }
  }

  // Se puede pedir otro período a mano (?periodo=2026-11) para adelantarlo.
  const periodo = req.nextUrl.searchParams.get("periodo") || currentPeriod();
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    return NextResponse.json({ error: "período inválido" }, { status: 400 });
  }

  try {
    const res = await runRutinasMensuales(createAdmin(), periodo);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const error = e instanceof Error ? e.message : "falló";
    return NextResponse.json({ ok: false, periodo, error }, { status: 500 });
  }
}
