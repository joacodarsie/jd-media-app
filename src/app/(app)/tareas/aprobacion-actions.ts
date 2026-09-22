"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { personasClave } from "@/lib/tareas/personas-clave";
import { motivoParaNoCerrarTareas } from "@/lib/contenidos/archivo-final-db";
import { puedeRepartir, vaPorLaPm } from "@/lib/tareas/puerta";

async function sesion() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data } = await createAdmin().from("users").select("rol, nombre").eq("id", user.id).maybeSingle();
  const u = data as { rol: string; nombre: string } | null;
  return { supabase, actor: { id: user.id, rol: u?.rol ?? null }, nombre: u?.nombre ?? "Alguien" };
}

function refrescar(id: string) {
  revalidatePath("/tareas");
  revalidatePath(`/tareas/${id}`);
  revalidatePath("/dashboard");
}

/**
 * Lo que la ventana del ticket necesita saber para explicar la puerta: a quién
 * le va a llegar el pedido y quién lo va a aprobar.
 */
export async function obtenerPuerta() {
  const { actor } = await sesion();
  const clave = await personasClave();
  return {
    pmNombre: clave.pmNombre,
    directoraNombre: clave.directoraNombre,
    hayPm: !!clave.pmId,
    /** true = quien crea puede asignar directo (la PM o la dirección). */
    libre: puedeRepartir(actor, clave.pmId),
  };
}

type TareaEnRevision = {
  id: string;
  titulo: string;
  estado: string;
  area: string | null;
  asignado_a_id: string | null;
  aprobador_id: string | null;
};

async function tareaParaAprobar(id: string) {
  const { data } = await createAdmin()
    .from("tasks")
    .select("id, titulo, estado, area, asignado_a_id, aprobador_id")
    .eq("id", id)
    .maybeSingle();
  return data as TareaEnRevision | null;
}

function puedeAprobar(t: TareaEnRevision, actor: { id: string; rol: string | null }, directoraId: string | null) {
  return actor.rol === "admin" || actor.id === (t.aprobador_id ?? directoraId) || actor.id === directoraId;
}

async function avisar(userId: string | null, yo: string, taskId: string, mensaje: string) {
  if (!userId || userId === yo) return;
  await createAdmin()
    .from("notifications")
    .insert({ user_id: userId, task_id: taskId, tipo: "asignacion", mensaje, link: `/tareas/${taskId}` });
}

/** La directora aprueba: la pieza queda lista para mandarle al cliente. */
export async function aprobarTarea(id: string) {
  const { supabase, actor, nombre } = await sesion();
  const [t, clave] = await Promise.all([tareaParaAprobar(id), personasClave()]);
  if (!t) return { error: "No encontré el ticket." };
  if (t.estado !== "en_revision") return { error: "Este ticket no está esperando aprobación." };
  if (!puedeAprobar(t, actor, clave.directoraId)) {
    return { error: "Solo la dirección creativa puede aprobar este ticket." };
  }
  const bloqueo = await motivoParaNoCerrarTareas(createAdmin(), [id], "completada");
  if (bloqueo) return { error: bloqueo };

  const { error } = await supabase.from("tasks").update({ estado: "completada" }).eq("id", id);
  if (error) return { error: error.message };

  await supabase
    .from("comments")
    .insert({ task_id: id, user_id: actor.id, contenido: "✅ Aprobado. Listo para mandar al cliente." });
  await avisar(t.asignado_a_id, actor.id, id, `${nombre.split(" ")[0]} aprobó "${t.titulo}"`);
  refrescar(id);
  return { ok: true };
}

/**
 * La directora pide cambios. El detalle es obligatorio: "no me gusta" obliga a
 * adivinar, y adivinar es otra vuelta de revisión.
 */
export async function pedirCambios(id: string, detalle: string) {
  const texto = detalle.trim();
  if (texto.length < 10) return { error: "Escribí qué hay que corregir, así se hace una sola vuelta." };
  const { supabase, actor, nombre } = await sesion();
  const [t, clave] = await Promise.all([tareaParaAprobar(id), personasClave()]);
  if (!t) return { error: "No encontré el ticket." };
  if (t.estado !== "en_revision") return { error: "Este ticket no está esperando aprobación." };
  if (!puedeAprobar(t, actor, clave.directoraId)) {
    return { error: "Solo la dirección creativa puede pedir cambios en este ticket." };
  }

  const { error } = await supabase.from("tasks").update({ estado: "en_progreso" }).eq("id", id);
  if (error) return { error: error.message };

  await supabase
    .from("comments")
    .insert({ task_id: id, user_id: actor.id, contenido: `✏️ Cambios pedidos:\n\n${texto}` });
  await avisar(t.asignado_a_id, actor.id, id, `${nombre.split(" ")[0]} pidió cambios en "${t.titulo}"`);
  refrescar(id);
  return { ok: true };
}

/** La PM reparte: le pasa el ticket (o la subtarea) a quien lo va a hacer. */
export async function reasignarTarea(id: string, userId: string) {
  const { supabase, actor } = await sesion();
  const clave = await personasClave();
  const { data } = await createAdmin().from("tasks").select("area").eq("id", id).maybeSingle();
  const area = (data as { area: string | null } | null)?.area ?? null;
  if (vaPorLaPm(area) && !puedeRepartir(actor, clave.pmId)) {
    return { error: "Los tickets de community, diseño y edición los reparte la Project Manager." };
  }
  const { error } = await supabase.from("tasks").update({ asignado_a_id: userId }).eq("id", id);
  if (error) return { error: error.message };
  refrescar(id);
  return { ok: true };
}
