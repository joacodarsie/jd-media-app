/**
 * El aviso de vencimiento de los documentos de campaña (23/10/2026): a la
 * dirección creativa de la cuenta, 7 días antes y el día que vence, para
 * replantear la estrategia. Uno por documento y por momento.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ENTREGABLES, AVISO_DIAS, vigencia, type Entregable } from "./creativa";

export function avisoVencimiento(cliente: string, entregable: Entregable, vence: string, dias: number): string {
  const que = ENTREGABLES[entregable].label;
  const cuando = dias <= 0 ? "vence hoy" : `vence el ${vence.slice(8, 10)}/${vence.slice(5, 7)}`;
  return `📄 La ${que.toLowerCase()} de ${cliente} ${cuando}: hora de replantear la estrategia.`;
}

export async function runAvisoVencimientos(admin: SupabaseClient, hoy: string): Promise<{ avisados: number }> {
  const { data: docs } = await admin
    .from("documents")
    .select("id, cliente_id, entregable, campana_inicio, campana_dias, cliente:clients(nombre, estado, responsable_id)")
    .not("entregable", "is", null)
    .not("campana_inicio", "is", null);
  const { data: admins } = await admin.from("users").select("id").eq("rol", "admin").eq("activo", true);
  let avisados = 0;
  for (const d of (docs ?? []) as unknown as {
    id: string;
    cliente_id: string;
    entregable: Entregable;
    campana_inicio: string;
    campana_dias: number | null;
    cliente: { nombre: string; estado: string; responsable_id: string | null } | null;
  }[]) {
    if (d.cliente?.estado !== "activo") continue;
    const v = vigencia(d.campana_inicio, d.campana_dias, hoy);
    // Dos momentos: a los 7 días y el mismo día.
    if (v.diasRestantes !== AVISO_DIAS && v.diasRestantes !== 0) continue;
    const link = `/creativa/${d.cliente_id}#doc-${d.id}`;
    const para = d.cliente.responsable_id ? [d.cliente.responsable_id] : ((admins ?? []) as { id: string }[]).map((a) => a.id);
    const mensaje = avisoVencimiento(d.cliente.nombre, d.entregable, v.vence!, v.diasRestantes);
    for (const uid of para) {
      const { data: ya } = await admin.from("notifications").select("id").eq("user_id", uid).eq("link", link).eq("mensaje", mensaje).limit(1);
      if (ya?.length) continue;
      await admin.from("notifications").insert({ user_id: uid, tipo: "recordatorio", mensaje, link });
      avisados++;
    }
  }
  return { avisados };
}
