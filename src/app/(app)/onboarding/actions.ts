"use server";

import { revalidatePath } from "next/cache";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { tituloMadre } from "@/lib/retencion/onboarding-15";
import { correrPasos, inicioDelArranque } from "@/lib/retencion/reunion-onboarding";
import { textoPregunta, tipoPregunta } from "@/lib/pm/tablero";
import { sendPushToUsers } from "@/lib/push";

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

/**
 * Las preguntas del arranque se contestan Sí o No desde el tablero de la PM
 * (20/10/2026). Queda la respuesta como comentario en la tarea y:
 *  - material/contenido: Sí cierra; No la pausa esperando al cliente con lo
 *    que falta (lo ve en su portal y el reloj se frena).
 *  - jornada: Sí cierra y le arma a la PM «Coordinar la jornada de producción»;
 *    No cierra.
 *  - el resto: cierra con la respuesta anotada.
 */
export async function responderPregunta(taskId: string, respuesta: "si" | "no", detalle?: string) {
  const me = await requireUser();
  if (!userInRoles(me, ["admin", "coordinador"])) return { error: "Las preguntas las contesta la coordinación." };
  const admin = createAdmin();
  const { data: t } = await admin.from("tasks").select("id, titulo, cliente_id, estado, cliente:clients(nombre)").eq("id", taskId).maybeSingle();
  const tarea = t as unknown as { id: string; titulo: string; cliente_id: string | null; estado: string; cliente: { nombre: string } | null } | null;
  if (!tarea) return { error: "No encontré esa pregunta." };
  if (tarea.estado === "completada") return { ok: true as const };
  const tipo = tipoPregunta(tarea.titulo);
  const nota = detalle?.trim().slice(0, 300) || null;
  await admin.from("comments").insert({
    task_id: tarea.id,
    user_id: me.id,
    contenido: `🙋 ${textoPregunta(tarea.titulo)} ${respuesta === "si" ? "Sí" : "No"}${nota ? ` — ${nota}` : ""}`,
  });

  if (tipo === "material" && respuesta === "no") {
    const { error } = await admin
      .from("tasks")
      .update({
        bloqueo: "cliente",
        bloqueo_detalle: nota ?? "el material crudo para las primeras publicaciones",
        bloqueo_at: new Date().toISOString(),
      })
      .eq("id", tarea.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from("tasks").update({ estado: "completada" }).eq("id", tarea.id);
    if (error) return { error: error.message };
    if (tipo === "jornada" && respuesta === "si" && tarea.cliente_id) {
      const hoy = new Date();
      const en3 = new Date(hoy.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
      await admin.from("tasks").insert({
        titulo: `Coordinar la jornada de producción — ${tarea.cliente?.nombre ?? "cuenta"}`,
        descripcion: `En el arranque se respondió que hace falta jornada${nota ? `: ${nota}` : ""}. Agendala con el cliente y el equipo desde la Agenda (tipo «Jornada»), con los viáticos si corresponden.`,
        asignado_a_id: me.id,
        creado_por_id: me.id,
        cliente_id: tarea.cliente_id,
        area: "Coordinación",
        prioridad: "alta",
        estado: "pendiente",
        fecha_limite: en3,
      });
    }
  }
  revalidatePath("/onboarding");
  return { ok: true as const, pausada: tipo === "material" && respuesta === "no" };
}

/** «Avisar»: le recuerda a quien tiene un paso atrasado del arranque. */
export async function avisarPasoAtrasado(taskId: string) {
  const me = await requireUser();
  if (!userInRoles(me, ["admin", "coordinador"])) return { error: "Solo coordinación." };
  const admin = createAdmin();
  const { data: t } = await admin.from("tasks").select("id, titulo, asignado_a_id, cliente:clients(nombre)").eq("id", taskId).maybeSingle();
  const tarea = t as unknown as { id: string; titulo: string; asignado_a_id: string | null; cliente: { nombre: string } | null } | null;
  if (!tarea?.asignado_a_id) return { error: "La tarea no tiene responsable." };
  if (tarea.asignado_a_id === me.id) return { error: "Es tuya: no hace falta avisarte." };
  const mensaje = `⏰ ${me.nombre.split(" ")[0]} te recuerda: «${tarea.titulo}»${tarea.cliente ? ` (${tarea.cliente.nombre})` : ""} está atrasada en el arranque.`;
  await admin.from("notifications").insert({ user_id: tarea.asignado_a_id, task_id: tarea.id, tipo: "recordatorio", mensaje, link: `/tareas/${tarea.id}` });
  await sendPushToUsers([tarea.asignado_a_id], { title: "⏰ Paso atrasado del arranque", body: mensaje, url: `/tareas/${tarea.id}`, tag: `pm-aviso-${tarea.id}` }).catch(() => undefined);
  return { ok: true as const };
}
