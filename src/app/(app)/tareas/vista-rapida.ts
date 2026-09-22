"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Lo mínimo para mirar una tarea sin abrirla.
 *
 * No es la ficha entera a propósito: si trae todo, deja de ser un vistazo y
 * además tarda. Queda afuera el historial, los tiempos, los links y los
 * adjuntos — para eso está el botón que abre la tarea completa.
 */
export interface TareaEnVistaRapida {
  id: string;
  numero: number | null;
  titulo: string;
  descripcion: string | null;
  estado: string;
  prioridad: string | null;
  area: string | null;
  fecha_limite: string | null;
  cliente: { id: string; nombre: string } | null;
  asignado: { id: string; nombre: string } | null;
  subtareas: {
    id: string;
    numero: number | null;
    titulo: string;
    estado: string;
  }[];
  /** Cuántos comentarios tiene y el último, que suele ser la novedad. */
  comentarios: number;
  ultimoComentario: {
    autor: string | null;
    texto: string;
    fecha: string;
  } | null;
}

/**
 * Trae una tarea para la ventanita de vista rápida.
 *
 * Va por `createClient` (no admin) a propósito: la RLS es la misma que la de
 * la página completa, así nadie ve por la ventanita lo que no vería entrando.
 */
export async function verTareaRapido(
  id: string
): Promise<{ tarea: TareaEnVistaRapida } | { error: string }> {
  await requireUser();
  const supabase = createClient();

  const [{ data: task }, { data: subs }, { count }, { data: ultimo }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, numero, titulo, descripcion, estado, prioridad, area, fecha_limite, cliente:clients(id,nombre), asignado:users!tasks_asignado_a_id_fkey(id,nombre)"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("id, numero, titulo, estado")
        .eq("parent_id", id)
        .order("created_at"),
      supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("task_id", id),
      supabase
        .from("comments")
        .select("contenido, created_at, autor:users(nombre)")
        .eq("task_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!task) return { error: "No se encontró la tarea." };

  const uno = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const t = task as unknown as Omit<
    TareaEnVistaRapida,
    "cliente" | "asignado" | "subtareas" | "comentarios" | "ultimoComentario"
  > & {
    cliente: { id: string; nombre: string }[] | { id: string; nombre: string } | null;
    asignado: { id: string; nombre: string }[] | { id: string; nombre: string } | null;
  };

  const u = ultimo as unknown as
    | { contenido: string; created_at: string; autor: { nombre: string }[] | { nombre: string } | null }
    | null;

  return {
    tarea: {
      id: t.id,
      numero: t.numero,
      titulo: t.titulo,
      descripcion: t.descripcion,
      estado: t.estado,
      prioridad: t.prioridad,
      area: t.area,
      fecha_limite: t.fecha_limite,
      cliente: uno(t.cliente),
      asignado: uno(t.asignado),
      subtareas: (subs ?? []) as TareaEnVistaRapida["subtareas"],
      comentarios: count ?? 0,
      ultimoComentario: u
        ? {
            autor: uno(u.autor)?.nombre ?? null,
            texto: u.contenido,
            fecha: u.created_at,
          }
        : null,
    },
  };
}
