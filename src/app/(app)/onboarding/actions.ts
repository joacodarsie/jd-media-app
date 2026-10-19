"use server";

import { revalidatePath } from "next/cache";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { tituloMadre } from "@/lib/retencion/onboarding-15";
import { correrPasos, inicioDelArranque } from "@/lib/retencion/reunion-onboarding";

/**
 * Marca el día de la reunión de onboarding (19/10/2026, pedido de Luz): el
 * arranque se cuenta desde ahí. Los pasos que siguen abiertos (y la tarea
 * madre) se corren los mismos días que se movió el inicio.
 */
export async function marcarReunionOnboarding(clienteId: string, fecha: string) {
  const me = await requireUser();
  if (!userInRoles(me, ["admin", "coordinador", "coordinador_diseno"])) return { error: "Solo coordinación puede cambiarla." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida." };
  const admin = createAdmin();
  const { data: c } = await admin.from("clients").select("nombre, fecha_inicio, onboarding_reunion").eq("id", clienteId).maybeSingle();
  const cli = c as { nombre: string; fecha_inicio: string | null; onboarding_reunion: string | null } | null;
  if (!cli) return { error: "No encontré la cuenta." };
  const viejo = inicioDelArranque(cli) ?? fecha;

  const { error } = await admin.from("clients").update({ onboarding_reunion: fecha }).eq("id", clienteId);
  if (error) return { error: /onboarding_reunion/.test(error.message) ? "Falta aplicar la migración 0208." : error.message };

  // La madre del arranque y sus pasos.
  const { data: madre } = await admin
    .from("tasks")
    .select("id, estado, fecha_limite")
    .eq("cliente_id", clienteId)
    .is("parent_id", null)
    .like("titulo", `${tituloMadre("")}%`)
    .neq("estado", "archivada")
    .limit(1)
    .maybeSingle();
  let corridos = 0;
  if (madre) {
    const m = madre as { id: string; estado: string; fecha_limite: string | null };
    const { data: hijos } = await admin.from("tasks").select("id, estado, fecha_limite").eq("parent_id", m.id);
    const cambios = correrPasos([m, ...((hijos ?? []) as { id: string; estado: string; fecha_limite: string | null }[])], viejo, fecha);
    for (const x of cambios) {
      await admin.from("tasks").update({ fecha_limite: x.fecha_limite }).eq("id", x.id);
    }
    corridos = cambios.length;
  }
  revalidatePath("/onboarding");
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true as const, corridos };
}
