"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

/**
 * Completa "quién cerró la cuenta" en varias cuentas de una.
 *
 * De `cerrado_por_id` sale la comisión del comercial (`selectFirstMonthCommissions`).
 * El formulario de cliente ya lo exige para las activas, pero las cuentas
 * anteriores quedaron sin el dato y arreglarlas de a una no iba a pasar nunca.
 *
 * Ojo: esto NO genera comisión retroactiva. La comisión se calcula sobre el
 * primer mes de la cuenta, así que completar una cuenta vieja solo arregla la
 * atribución (de quién es la cartera), no paga plata hacia atrás.
 */
export async function asignarCerradores(
  asignaciones: { clienteId: string; userId: string }[]
) {
  await requireRole(["admin", "coordinador"]);
  if (!Array.isArray(asignaciones) || asignaciones.length === 0) {
    return { ok: true, n: 0 };
  }
  const admin = createAdmin();
  const errores: string[] = [];
  let n = 0;

  for (const a of asignaciones.slice(0, 100)) {
    if (!a.clienteId || !a.userId) continue;
    const { error } = await admin
      .from("clients")
      .update({ cerrado_por_id: a.userId })
      .eq("id", a.clienteId);
    if (error) errores.push(error.message);
    else n += 1;
  }

  if (errores.length > 0) return { error: errores[0] };

  revalidatePath("/coordinacion/comercial");
  revalidatePath("/objetivos/maquina");
  revalidatePath("/clientes");
  return { ok: true, n };
}
