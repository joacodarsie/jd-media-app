"use server";

import { revalidatePath } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { AREA_PM } from "@/lib/tareas/puerta";
import { sendPushToUsers } from "@/lib/push";
import { avisoTrabada, type TipoTraba } from "@/lib/tareas/trabada";

/** La gente del equipo, para elegir a quién se está esperando. */
export async function personasParaTraba(): Promise<{ id: string; nombre: string }[]> {
  const me = await requireUser();
  const { data } = await createAdmin().from("users").select("id, nombre").eq("activo", true).order("nombre");
  return ((data ?? []) as { id: string; nombre: string }[]).filter((u) => u.id !== me.id);
}

/**
 * «Estoy trabado» (19/10/2026, 0206). La marca quien tiene la tarea (o
 * colabora): le avisa a quien la destraba y la tarea deja de contar como
 * atraso en el semáforo mientras espera.
 */
export async function marcarTrabada(input: {
  taskId: string;
  tipo: TipoTraba;
  esperandoId?: string | null;
  detalle?: string | null;
}) {
  const me = await requireUser();
  const admin = createAdmin();
  const { data: t } = await admin
    .from("tasks")
    .select("id, titulo, asignado_a_id, colaboradores, cliente:clients(nombre, responsable_id)")
    .eq("id", input.taskId)
    .maybeSingle();
  const tarea = t as unknown as {
    id: string;
    titulo: string;
    asignado_a_id: string | null;
    colaboradores: string[] | null;
    cliente: { nombre: string; responsable_id: string | null } | null;
  } | null;
  if (!tarea) return { error: "No encontré esa tarea." };
  const esMia = tarea.asignado_a_id === me.id || (tarea.colaboradores ?? []).includes(me.id) || me.rol === "admin";
  if (!esMia) return { error: "Solo la puede marcar quien tiene la tarea." };
  if (input.tipo === "persona" && !input.esperandoId) return { error: "Elegí a quién estás esperando." };

  // A quién se le avisa: la persona que se espera, o la PM (que apura al
  // cliente) y el responsable de la cuenta.
  const { data: us } = await admin.from("users").select("id, nombre, area, area_secundaria").eq("activo", true);
  const lista = (us ?? []) as { id: string; nombre: string; area: string | null; area_secundaria: string | null }[];
  const pm = lista.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id ?? null;
  const esperando = input.tipo === "persona" ? lista.find((u) => u.id === input.esperandoId) ?? null : null;
  if (input.tipo === "persona" && !esperando) return { error: "Esa persona no está activa." };
  const avisar = (
    input.tipo === "persona" ? [esperando!.id] : [pm, tarea.cliente?.responsable_id ?? null]
  ).filter((x): x is string => !!x && x !== me.id);

  const detalle = input.detalle?.trim().slice(0, 300) || null;
  const { error } = await admin
    .from("tasks")
    .update({
      bloqueo: input.tipo,
      bloqueo_esperando_id: esperando?.id ?? null,
      bloqueo_quien: esperando?.nombre ?? null,
      bloqueo_detalle: detalle,
      bloqueo_at: new Date().toISOString(),
    })
    .eq("id", tarea.id);
  if (error) return { error: /bloqueo/.test(error.message) ? "Falta aplicar la migración 0206." : error.message };

  const mensaje = avisoTrabada({ quien: me.nombre.split(" ")[0], tarea: tarea.titulo, cuenta: tarea.cliente?.nombre ?? null, tipo: input.tipo, detalle });
  const destinos = [...new Set(avisar)];
  if (destinos.length) {
    await admin
      .from("notifications")
      .insert(destinos.map((user_id) => ({ user_id, task_id: tarea.id, tipo: "recordatorio", mensaje, link: `/tareas/${tarea.id}` })));
    await sendPushToUsers(destinos, { title: "🧱 Alguien te está esperando", body: mensaje, url: `/tareas/${tarea.id}`, tag: `trabada-${tarea.id}` }).catch(() => undefined);
  }
  revalidatePath("/dashboard");
  revalidatePath("/tareas");
  revalidatePath(`/tareas/${tarea.id}`);
  return { ok: true as const, avisados: destinos.length };
}

export async function destrabar(taskId: string) {
  const me = await requireUser();
  const admin = createAdmin();
  const { data: t } = await admin.from("tasks").select("asignado_a_id, colaboradores, bloqueo_esperando_id").eq("id", taskId).maybeSingle();
  const tarea = t as { asignado_a_id: string | null; colaboradores: string[] | null; bloqueo_esperando_id: string | null } | null;
  if (!tarea) return { error: "No encontré esa tarea." };
  const puede =
    tarea.asignado_a_id === me.id || (tarea.colaboradores ?? []).includes(me.id) || tarea.bloqueo_esperando_id === me.id || me.rol === "admin";
  if (!puede) return { error: "No podés destrabar esta tarea." };
  await admin
    .from("tasks")
    .update({ bloqueo: null, bloqueo_esperando_id: null, bloqueo_quien: null, bloqueo_detalle: null, bloqueo_at: null })
    .eq("id", taskId);
  revalidatePath("/dashboard");
  revalidatePath("/tareas");
  revalidatePath(`/tareas/${taskId}`);
  return { ok: true as const };
}
