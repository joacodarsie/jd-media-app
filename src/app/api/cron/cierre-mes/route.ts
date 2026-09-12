import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { cerrarMes } from "@/lib/finanzas/cierre-mes-run";
import { prevPeriod, currentPeriod, periodLabel } from "@/lib/finanzas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cierre del mes — corre el día 1 de cada mes.
 *
 * Deja PAGADOS los gastos fijos del mes que terminó: las suscripciones activas,
 * que la app ya genera sola como gastos del período. Son débitos automáticos,
 * así que darlos por pagados no inventa nada — y era el único paso que nunca
 * ocurría.
 *
 * Los SUELDOS no los toca a propósito: varían mes a mes y darlos por pagados
 * sin que el dueño lo confirme sería inventar un dato financiero. Para eso está
 * el botón "Ya pagué todo esto" del resumen.
 *
 * Por qué existe: /finanzas/resumen mostraba julio, agosto y septiembre de 2026
 * con $0 de egresos porque nadie registraba nada. El dueño no carga datos a
 * mano —y no debería: esto es siempre lo mismo—.
 *
 * Idempotente: el gasto se busca por (periodo, concepto) antes de crearlo, así
 * que correrlo de nuevo no duplica.
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

  const admin = createAdmin();
  // El mes que acaba de terminar. Si alguien lo corre a mano a mitad de mes,
  // igual cierra el anterior, que es lo que corresponde.
  const periodo = prevPeriod(currentPeriod());

  try {
    const res = await cerrarMes(admin, periodo, { incluirSueldos: false });
    if (res.errores.length > 0) {
      return NextResponse.json({ ok: false, periodo, errores: res.errores }, { status: 500 });
    }

    // Si se cargó algo, avisarle a los admins: es plata que apareció en los
    // números y conviene que lo sepan sin tener que descubrirlo.
    if (res.gastosMarcados > 0) {
      const { data: admins } = await admin
        .from("users")
        .select("id")
        .eq("rol", "admin")
        .eq("activo", true);
      const monto = "$" + Math.round(res.montoGastos).toLocaleString("es-AR");
      const filas = ((admins ?? []) as { id: string }[]).map((u) => ({
        user_id: u.id,
        tipo: "recordatorio" as const,
        mensaje:
          `Se cerró ${periodLabel(periodo)}: quedaron pagados los ${res.gastosMarcados} gastos ` +
          `fijos del mes (${monto}). Si ya les pagaste al equipo, marcalo en El resumen para ` +
          `que el número quede real.`,
      }));
      if (filas.length > 0) {
        // Si la tabla de notificaciones cambia o falla, el cierre ya se hizo:
        // no tumbamos el cron por el aviso.
        await admin.from("notifications").insert(filas);
      }
    }

    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json(
      { ok: false, periodo, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
