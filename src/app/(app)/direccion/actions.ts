"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createTask } from "@/app/(app)/tareas/actions";
import { AREA_DIRECCION } from "@/lib/direccion/rutina";

/**
 * La dirección le pide algo a un coordinador: es una tarea normal, asignada a
 * esa persona y creada por la dirección. Así entra en "Lo que le pediste" y en
 * sus vencidas, sin inventar otro concepto (los tickets ya se entienden).
 */
export async function pedirACoordinador(personaId: string, titulo: string, fecha: string) {
  const me = await requireUser();
  if (me.area !== AREA_DIRECCION) return { error: "Solo la dirección puede pedir desde acá." };
  const texto = titulo.trim();
  if (texto.length < 4) return { error: "Escribí qué le pedís." };
  const r = await createTask({
    titulo: texto.slice(0, 200),
    descripcion: "Pedido de la dirección.",
    asignado_a_id: personaId,
    cliente_id: null,
    area: "Coordinación",
    prioridad: "media",
    fecha_limite: fecha,
  });
  if (r && "error" in r && r.error) return { error: r.error };
  revalidatePath("/direccion");
  return { ok: true };
}
