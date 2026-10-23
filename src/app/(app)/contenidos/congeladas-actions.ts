"use server";

import { revalidatePath } from "next/cache";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { sendPushToUsers } from "@/lib/push";
import { cargarCongeladas } from "@/lib/contenidos/congeladas-run";
import { mensajeAvisoPersona } from "@/lib/contenidos/congeladas";

/**
 * «Avisar» desde el bloque de piezas congeladas (22/10/2026): un solo aviso a
 * la persona con todas las suyas, no uno por pieza.
 */
export async function avisarCongeladas(responsableId: string) {
  const me = await requireUser();
  if (!userInRoles(me, ["admin", "coordinador"])) return { error: "Solo coordinación." };
  if (responsableId === me.id) return { error: "Son tuyas: no hace falta avisarte." };
  const admin = createAdmin();
  const grupo = (await cargarCongeladas(admin, hoyYmd())).find((g) => g.responsableId === responsableId);
  if (!grupo) return { error: "Ya no tiene piezas congeladas." };
  const mensaje = mensajeAvisoPersona(me.nombre, grupo);
  await admin.from("notifications").insert({ user_id: responsableId, tipo: "recordatorio", mensaje, link: "/tareas" });
  await sendPushToUsers([responsableId], { title: "🧊 Piezas sin moverse", body: mensaje, url: "/tareas", tag: `congeladas-${responsableId}` }).catch(
    () => undefined
  );
  revalidatePath("/dashboard");
  return { ok: true as const };
}
