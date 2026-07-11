"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

// Solo admin edita los números de la agencia desde el panorama.
async function ctx() {
  const me = await requireUser();
  if (me.rol !== "admin") {
    throw new Error("Solo un administrador puede editar los números de la agencia.");
  }
  return { supabase: createClient() };
}

/**
 * Cambia el abono mensual de una cuenta directo desde la grilla del panorama.
 * Toca solo el `monto_mensual` del servicio de gestión de redes ya existente
 * (no crea ni da de baja nada). Es la edición estilo Excel de los ingresos.
 */
export async function updateClientAbono(serviceId: string, monto: number) {
  const { supabase } = await ctx();
  if (!Number.isFinite(monto) || monto < 0) return { error: "Monto inválido." };
  const { error } = await supabase
    .from("client_services")
    .update({ monto_mensual: Math.round(monto) })
    .eq("id", serviceId)
    .eq("tipo", "gestion_redes");
  if (error) return { error: error.message };
  revalidatePath("/finanzas/panorama");
  revalidatePath("/finanzas");
  revalidatePath("/coordinacion");
  return { ok: true };
}
