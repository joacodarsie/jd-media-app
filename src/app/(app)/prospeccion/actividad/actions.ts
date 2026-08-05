"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { normalizarMeta } from "@/lib/prospecting/actividad";

type ActionResult = { ok: true; meta: number | null } | { ok: false; error: string };

/**
 * Cambia la meta diaria de prospección de una persona.
 *
 * Solo admin: es el número contra el que se mide al equipo, no lo edita
 * cualquiera. `null` vuelve al valor por defecto; `0` significa que a esa
 * persona no se le exige nada.
 */
export async function setMetaProspeccion(
  userId: string,
  valor: number | string | null
): Promise<ActionResult> {
  const me = await requireUser();
  if (me.rol !== "admin") {
    return { ok: false, error: "Solo un admin puede cambiar las metas." };
  }

  const meta = normalizarMeta(valor);

  const { error } = await createAdmin()
    .from("users")
    .update({ meta_prospeccion: meta })
    .eq("id", userId);

  if (error) {
    // La migración 0149 todavía no aplicada es el caso esperable.
    if (/meta_prospeccion/i.test(error.message)) {
      return {
        ok: false,
        error: "Falta aplicar la migración 0149 en Supabase para poder editar las metas.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/prospeccion/actividad");
  return { ok: true, meta };
}
