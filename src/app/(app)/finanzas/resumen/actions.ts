"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { cerrarMes } from "@/lib/finanzas/cierre-mes-run";

/**
 * "Ya pagué todo esto": deja el mes registrado.
 *
 * Lo dispara el dueño desde el resumen, confirmando que transfirió los sueldos
 * y que la estructura se debitó. No se hace solo para los sueldos porque
 * afirmar que se le pagó a alguien sin que él lo diga sería inventar un dato
 * financiero.
 */
export async function cerrarPagosDelMes(periodo: string) {
  const me = await requireRole(["admin"]);
  if (!/^\d{4}-\d{2}$/.test(periodo)) return { error: "Período inválido" };

  const res = await cerrarMes(createAdmin(), periodo, {
    incluirSueldos: true,
    creadoPorId: me.id,
  });
  if (res.errores.length > 0) return { error: res.errores.join(" · ") };

  revalidatePath("/finanzas/resumen");
  revalidatePath("/finanzas");
  revalidatePath("/coordinacion/sueldos");
  return {
    ok: true,
    personas: res.personas,
    montoEquipo: res.montoEquipo,
    gastos: res.gastosMarcados,
    montoGastos: res.montoGastos,
  };
}
