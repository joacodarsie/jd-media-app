"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

/**
 * El registro de quejas de los clientes.
 *
 * Lo ven y lo cargan la Dirección y el Comercial (el responsable de cuentas):
 * dice quién se quejó, de qué área y cómo terminó. Con eso se mide la calidad
 * de la gestión de cada cuenta, que hasta ahora vivía en los grupos de
 * WhatsApp y no se podía mirar junta.
 */
const ROLES = ["admin", "comercial"];

async function ctx() {
  const me = await requireRole(ROLES);
  return { admin: createAdmin(), userId: me.id };
}

function invalidate(clienteId?: string | null) {
  revalidatePath("/quejas");
  if (clienteId) revalidatePath(`/clientes/${clienteId}`);
}

export async function createComplaint(input: {
  cliente_id: string;
  area: string;
  gravedad: string;
  detalle: string;
  fecha: string | null;
}) {
  const { admin, userId } = await ctx();
  if (!input.cliente_id) return { error: "Elegí de qué cliente es la queja." };
  if (!input.detalle.trim()) return { error: "Contá qué pasó." };

  const { error } = await admin.from("client_complaints").insert({
    cliente_id: input.cliente_id,
    area: input.area,
    gravedad: input.gravedad,
    detalle: input.detalle.trim(),
    ...(input.fecha ? { fecha: input.fecha } : {}),
    creado_por_id: userId,
  });
  if (error) return { error: error.message };
  invalidate(input.cliente_id);
  return { ok: true };
}

/**
 * Cambia el estado. Al resolverla se guarda la fecha y, si se escribió, qué se
 * hizo: sin eso el registro dice que hubo un problema pero no si se arregló.
 */
export async function setComplaintEstado(
  id: string,
  estado: "abierta" | "en_proceso" | "resuelta",
  resolucion?: string | null
) {
  const { admin } = await ctx();
  const { data, error } = await admin
    .from("client_complaints")
    .update({
      estado,
      resuelta_at: estado === "resuelta" ? new Date().toISOString() : null,
      ...(resolucion !== undefined ? { resolucion: resolucion?.trim() || null } : {}),
    })
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate((data as { cliente_id: string } | null)?.cliente_id);
  return { ok: true };
}

export async function deleteComplaint(id: string) {
  const { admin } = await ctx();
  const { data, error } = await admin
    .from("client_complaints")
    .delete()
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate((data as { cliente_id: string } | null)?.cliente_id);
  return { ok: true };
}
