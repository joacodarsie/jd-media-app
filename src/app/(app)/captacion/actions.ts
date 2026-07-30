"use server";

import { revalidatePath } from "next/cache";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import type { TipoAccion } from "@/lib/captacion/plan";

const ROLES_OK = ["admin", "coordinador", "comercial", "prospecting"];

async function ensure(): Promise<{ error?: string; userId?: string }> {
  const me = await requireUser();
  if (!userInRoles(me, ROLES_OK)) return { error: "No tenés acceso a captación." };
  return { userId: me.id };
}

/**
 * Marca que ya se le escribió a alguien. Es el único dato que hay que cargar
 * en toda la pantalla, y sale de apretar el mismo botón que copia el mensaje.
 */
export async function marcarHecho(input: {
  tipo: TipoAccion;
  targetId: string;
  targetNombre: string;
  resultado?: string;
  notas?: string | null;
}) {
  const { error: gate, userId } = await ensure();
  if (gate) return { error: gate };

  const { error } = await createAdmin().from("outreach_log").insert({
    tipo: input.tipo,
    target_id: input.targetId,
    target_nombre: input.targetNombre.slice(0, 160),
    resultado: input.resultado ?? "pedido",
    notas: input.notas?.trim() || null,
    user_id: userId,
  });

  if (error) {
    if ((error as { code?: string }).code === "42P01")
      return { error: "Falta aplicar la migración 0143 para poder marcarlo." };
    return { error: error.message };
  }
  revalidatePath("/captacion");
  return { ok: true as const };
}

/** Deshace la marca (se apretó sin querer). */
export async function desmarcar(tipo: TipoAccion, targetId: string) {
  const { error: gate } = await ensure();
  if (gate) return { error: gate };
  const { error } = await createAdmin()
    .from("outreach_log")
    .delete()
    .eq("tipo", tipo)
    .eq("target_id", targetId);
  if (error) return { error: error.message };
  revalidatePath("/captacion");
  return { ok: true as const };
}

/** Anota el resultado de un pedido ya hecho (dio referido / no / cerró). */
export async function anotarResultado(input: {
  tipo: TipoAccion;
  targetId: string;
  targetNombre: string;
  resultado: "dio_referido" | "no" | "cerrado" | "respondio";
  notas?: string | null;
}) {
  return marcarHecho(input);
}
