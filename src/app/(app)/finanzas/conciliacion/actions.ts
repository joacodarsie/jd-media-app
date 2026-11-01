"use server";

import { revalidatePath } from "next/cache";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { confirmarMovimiento, deshacerMovimiento } from "@/lib/finanzas/conciliar-run";

function invalidate() {
  revalidatePath("/finanzas/conciliacion");
  revalidatePath("/finanzas/mes");
  revalidatePath("/finanzas/pagos");
  revalidatePath("/finanzas/cobros");
  revalidatePath("/cobros");
}

export async function confirmar(clave: string) {
  const me = await requireFeature("finanzas");
  const r = await confirmarMovimiento(createAdmin(), clave, me.id);
  invalidate();
  return r.error ? { error: r.error } : { ok: true as const };
}

export async function deshacer(clave: string) {
  const me = await requireFeature("finanzas");
  const r = await deshacerMovimiento(createAdmin(), clave, me.id);
  invalidate();
  return r.error ? { error: r.error } : { ok: true as const };
}
