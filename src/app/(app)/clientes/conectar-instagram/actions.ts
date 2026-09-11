"use server";

import { revalidatePath } from "next/cache";
import { requireUser, isStaffUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { normalizarHandle } from "@/lib/social/ig-handle";

const CAN_MANAGE = ["admin", "coordinador", "paid_media"];

/**
 * Guarda el @ de Instagram en la ficha del cliente.
 *
 * Está acá y no solo en la ficha porque esta es la pantalla donde se ve el
 * hueco: cuatro cuentas activas no tenían el @ en ningún campo de la base, y
 * mientras no esté, no hay con qué pedirle el acceso a Meta ni con qué
 * matchear. Cargarlo donde se nota que falta es lo que hace que se cargue.
 */
export async function guardarIgHandle(
  clienteId: string,
  valor: string
): Promise<{ ok: true; handle: string } | { error: string }> {
  const me = await requireUser();
  if (!isStaffUser(me) && !userInRoles(me, CAN_MANAGE)) return { error: "Sin acceso." };

  const n = normalizarHandle(valor);
  if (!n.ok) return { error: n.error! };

  const admin = createAdmin();
  const { error } = await admin
    .from("clients")
    .update({ ig_username: n.handle, instagram_url: n.url })
    .eq("id", clienteId);
  if (error) return { error: error.message };

  revalidatePath("/clientes/conectar-instagram");
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true, handle: n.handle! };
}

export interface ParConexion {
  clienteId: string;
  igUserId: string;
  igUsername: string | null;
}

/**
 * Conecta varias cuentas de Instagram de una. Es la versión en lote de
 * `connectIgAccount`: mismo efecto (escribe ig_user_id / ig_username en el
 * cliente), pero para las 15 cuentas que quedaron sin conectar.
 *
 * Los datos empiezan a llegar solos con el sync diario; no traemos las métricas
 * acá para no colgar la acción con 15 llamadas a la Graph API.
 */
export async function bulkConnectIg(
  pares: ParConexion[]
): Promise<{ ok: true; conectadas: number } | { error: string }> {
  const me = await requireUser();
  if (!isStaffUser(me) && !userInRoles(me, CAN_MANAGE)) return { error: "Sin acceso." };
  if (!Array.isArray(pares) || pares.length === 0) return { ok: true, conectadas: 0 };

  const limpios = pares
    .filter((p) => p.clienteId && /^\d+$/.test(p.igUserId.trim()))
    .slice(0, 100);
  if (limpios.length === 0)
    return { error: "No hay ninguna cuenta válida para conectar (el ID debe ser numérico)." };

  // Una misma cuenta de IG no puede quedar en dos clientes: sería mostrarle a
  // uno los números del otro.
  const vistos = new Set<string>();
  for (const p of limpios) {
    if (vistos.has(p.igUserId)) return { error: "Elegiste la misma cuenta de Instagram para dos clientes." };
    vistos.add(p.igUserId);
  }

  const admin = createAdmin();
  const { data: yaUsadas } = await admin
    .from("clients")
    .select("id, nombre, ig_user_id")
    .in("ig_user_id", [...vistos]);
  const choque = ((yaUsadas ?? []) as { id: string; nombre: string; ig_user_id: string }[]).find(
    (c) => !limpios.some((p) => p.clienteId === c.id && p.igUserId === c.ig_user_id)
  );
  if (choque) return { error: `Esa cuenta de Instagram ya está conectada a ${choque.nombre}.` };

  let conectadas = 0;
  for (const p of limpios) {
    const { error } = await admin
      .from("clients")
      .update({ ig_user_id: p.igUserId.trim(), ig_username: p.igUsername?.trim() || null })
      .eq("id", p.clienteId);
    if (error) return { error: error.message };
    conectadas++;
    revalidatePath(`/clientes/${p.clienteId}`);
    revalidatePath(`/clientes/${p.clienteId}/resultados`);
  }

  revalidatePath("/clientes/conectar-instagram");
  revalidatePath("/clientes");
  return { ok: true, conectadas };
}
