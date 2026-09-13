"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import type { TaskLink } from "@/lib/types";
import { motivoParaNoCerrarTareas } from "@/lib/contenidos/archivo-final-db";
import { validarFechaLimite } from "@/lib/tareas/fecha-limite";

async function uid() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

export async function createTask(input: {
  titulo: string;
  descripcion: string;
  asignado_a_id: string | null;
  cliente_id: string | null;
  area: string;
  prioridad: string;
  fecha_limite: string | null;
  aprobador_id?: string | null;
  requiere_aprobacion?: boolean;
}) {
  const { supabase, userId } = await uid();
  // Toda tarea lleva fecha límite: sin ella no aparece en el aviso diario y
  // deja de existir para todos. Se valida acá y no solo en el formulario
  // porque este es el único paso por el que pasan todas.
  const fecha = validarFechaLimite(input.fecha_limite);
  if (!fecha.ok) return { error: fecha.error! };
  const { error } = await supabase.from("tasks").insert({
    titulo: input.titulo,
    descripcion: input.descripcion || null,
    asignado_a_id: input.asignado_a_id || null,
    creado_por_id: userId,
    cliente_id: input.cliente_id || null,
    area: input.area,
    prioridad: input.prioridad,
    fecha_limite: fecha.fecha,
    aprobador_id: input.aprobador_id || null,
    requiere_aprobacion: input.requiere_aprobacion ?? !!input.aprobador_id,
  });
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  return { ok: true };
}


/**
 * Agrega una subtarea a un ticket madre.
 *
 * Hereda cliente, área y prioridad de la madre en vez de pedirlos de nuevo: son
 * los mismos por definición —el desglose de un ticket pertenece a la misma
 * cuenta y al mismo trabajo— y cada campo extra en el formulario es una excusa
 * más para no cargar el desglose.
 *
 * El responsable y la fecha SÍ se piden: es justo lo que cambia entre una
 * subtarea y otra (la CM arma el ticket, Luz reparte a diseño y a edición con
 * fechas de entrega distintas). Si no se eligen, arrancan como los de la madre.
 */
export async function addSubtarea(input: {
  parentId: string;
  titulo: string;
  descripcion?: string | null;
  asignado_a_id?: string | null;
  fecha_limite?: string | null;
}) {
  const { supabase, userId } = await uid();
  if (!input.titulo.trim()) return { error: "Falta el título de la subtarea." };

  const { data: madre, error: errMadre } = await supabase
    .from("tasks")
    .select("id, cliente_id, area, prioridad, asignado_a_id, fecha_limite, parent_id")
    .eq("id", input.parentId)
    .maybeSingle();
  if (errMadre) return { error: errMadre.message };
  if (!madre) return { error: "No encontré el ticket." };
  // La base también lo impide (trigger de la 0165); acá damos el mensaje bueno.
  if ((madre as { parent_id: string | null }).parent_id) {
    return { error: "Esto ya es una subtarea: no se puede anidar otra adentro." };
  }

  const m = madre as {
    cliente_id: string | null;
    area: string;
    prioridad: string;
    asignado_a_id: string | null;
    fecha_limite: string | null;
  };

  const fecha = validarFechaLimite(input.fecha_limite ?? m.fecha_limite);
  if (!fecha.ok) return { error: fecha.error! };

  const { error } = await supabase.from("tasks").insert({
    titulo: input.titulo.trim(),
    descripcion: input.descripcion?.trim() || null,
    asignado_a_id: input.asignado_a_id || m.asignado_a_id || null,
    creado_por_id: userId,
    cliente_id: m.cliente_id,
    area: m.area,
    prioridad: m.prioridad,
    fecha_limite: fecha.fecha,
    parent_id: input.parentId,
  });
  if (error) return { error: error.message };

  revalidatePath("/tareas");
  revalidatePath(`/tareas/${input.parentId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTaskStatus(id: string, estado: string) {
  const { supabase } = await uid();
  const bloqueo = await motivoParaNoCerrarTareas(createAdmin(), [id], estado);
  if (bloqueo) return { error: bloqueo };
  const { error } = await supabase
    .from("tasks")
    .update({ estado })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  revalidatePath(`/tareas/${id}`);
  return { ok: true };
}

export async function updateTask(
  id: string,
  input: {
    titulo: string;
    descripcion: string;
    asignado_a_id: string | null;
    cliente_id: string | null;
    area: string;
    prioridad: string;
    estado: string;
    fecha_limite: string | null;
    aprobador_id?: string | null;
    requiere_aprobacion?: boolean;
  }
) {
  const { supabase } = await uid();
  const bloqueo = await motivoParaNoCerrarTareas(createAdmin(), [id], input.estado);
  if (bloqueo) return { error: bloqueo };
  // Editar una tarea tampoco puede dejarla sin fecha.
  const fecha = validarFechaLimite(input.fecha_limite);
  if (!fecha.ok) return { error: fecha.error! };
  const { error } = await supabase
    .from("tasks")
    .update({
      titulo: input.titulo,
      descripcion: input.descripcion || null,
      asignado_a_id: input.asignado_a_id || null,
      cliente_id: input.cliente_id || null,
      area: input.area,
      prioridad: input.prioridad,
      estado: input.estado,
      fecha_limite: fecha.fecha,
      aprobador_id: input.aprobador_id || null,
      requiere_aprobacion: input.requiere_aprobacion ?? !!input.aprobador_id,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  revalidatePath(`/tareas/${id}`);
  return { ok: true };
}

export async function deleteTask(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Actualiza el estado de varias tareas a la vez (bulk action). */
export async function bulkUpdateTaskStatus(ids: string[], estado: string) {
  const { supabase } = await uid();
  if (!ids.length) return { error: "Sin selección." };
  // Si no, marcar 20 tareas de una era la puerta de atrás del candado.
  const bloqueo = await motivoParaNoCerrarTareas(createAdmin(), ids, estado);
  if (bloqueo) return { error: bloqueo };
  const { error } = await supabase
    .from("tasks")
    .update({ estado })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  return { ok: true, count: ids.length };
}

/** Elimina varias tareas a la vez (bulk action). */
export async function bulkDeleteTasks(ids: string[]) {
  const { supabase } = await uid();
  if (!ids.length) return { error: "Sin selección." };
  const { error } = await supabase.from("tasks").delete().in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  return { ok: true, count: ids.length };
}

/**
 * Le pone la misma fecha límite a varias tareas (bulk action).
 *
 * Es la herramienta del triage de "Sin fecha": esas tareas existen pero nadie
 * las ve, y la salida es ponerles fecha o archivarlas. Sin esto había que
 * entrar de a una, y son decenas.
 */
export async function bulkSetDueDate(ids: string[], fechaLimite: string) {
  const { supabase } = await uid();
  if (!ids.length) return { error: "Sin selección." };
  const fecha = validarFechaLimite(fechaLimite);
  if (!fecha.ok) return { error: fecha.error! };
  const { error } = await supabase
    .from("tasks")
    .update({ fecha_limite: fecha.fecha })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  return { ok: true, count: ids.length };
}

/** Reasigna varias tareas al mismo usuario (bulk action). */
export async function bulkReassignTasks(ids: string[], newUserId: string) {
  const { supabase } = await uid();
  if (!ids.length) return { error: "Sin selección." };
  const { error } = await supabase
    .from("tasks")
    .update({ asignado_a_id: newUserId })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  return { ok: true, count: ids.length };
}

export async function saveLinks(id: string, links: TaskLink[]) {
  const { supabase } = await uid();
  const { error } = await supabase
    .from("tasks")
    .update({ links })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/tareas/${id}`);
  return { ok: true };
}

export async function addComment(taskId: string, contenido: string) {
  const { supabase, userId } = await uid();
  const text = contenido.trim();
  if (!text) return { error: "Comentario vacío" };

  const { error } = await supabase
    .from("comments")
    .insert({ task_id: taskId, user_id: userId, contenido: text });
  if (error) return { error: error.message };

  // Datos de la tarea para notificaciones
  const { data: task } = await supabase
    .from("tasks")
    .select("titulo, asignado_a_id, creado_por_id")
    .eq("id", taskId)
    .single();

  const { data: autor } = await supabase
    .from("users")
    .select("nombre")
    .eq("id", userId)
    .single();

  const notifs: {
    user_id: string;
    task_id: string;
    tipo: string;
    mensaje: string;
  }[] = [];

  // Menciones @Nombre
  const mentioned = Array.from(text.matchAll(/@([\p{L}]+)/gu)).map((m) =>
    m[1].toLowerCase()
  );
  if (mentioned.length) {
    const { data: users } = await supabase
      .from("users")
      .select("id, nombre")
      .eq("activo", true);
    for (const u of users ?? []) {
      const first = u.nombre.split(" ")[0].toLowerCase();
      if (mentioned.includes(first) && u.id !== userId) {
        notifs.push({
          user_id: u.id,
          task_id: taskId,
          tipo: "mencion",
          mensaje: `${autor?.nombre ?? "Alguien"} te mencionó en "${task?.titulo ?? "una tarea"}"`,
        });
      }
    }
  }

  // Aviso de comentario a asignado y creador (si no son el autor ni ya mencionados)
  const targets = new Set<string>();
  if (task?.asignado_a_id) targets.add(task.asignado_a_id);
  if (task?.creado_por_id) targets.add(task.creado_por_id);
  targets.delete(userId);
  for (const t of targets) {
    if (notifs.some((n) => n.user_id === t)) continue;
    notifs.push({
      user_id: t,
      task_id: taskId,
      tipo: "comentario",
      mensaje: `${autor?.nombre ?? "Alguien"} comentó en "${task?.titulo ?? "una tarea"}"`,
    });
  }

  // RLS de notifications restringe INSERT a auth.uid(). Para crear notifs
  // dirigidas a OTROS usuarios necesitamos service role.
  if (notifs.length) {
    const admin = createAdmin();
    await admin.from("notifications").insert(notifs);
  }

  revalidatePath(`/tareas/${taskId}`);
  return { ok: true };
}

export async function deleteComment(id: string, taskId: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/tareas/${taskId}`);
  return { ok: true };
}
