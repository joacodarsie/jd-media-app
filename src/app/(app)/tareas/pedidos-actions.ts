"use server";

import { revalidatePath } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser, userInRoles } from "@/lib/auth";
import {
  ROLES_QUE_RESUELVEN,
  mensajeParaCoordinacion,
  mensajeParaSolicitante,
  motivoMeta,
  type MotivoPedido,
} from "@/lib/tareas/pedidos";

function invalidate(taskId?: string) {
  revalidatePath("/tareas");
  if (taskId) revalidatePath(`/tareas/${taskId}`);
}

/**
 * Reportar un problema en una tarea. Lo puede hacer cualquiera del equipo:
 * justamente el que sufre la tarea mal cargada es el que no tiene permisos
 * para arreglarla.
 */
export async function reportarProblema(
  taskId: string,
  motivo: MotivoPedido,
  detalle: string,
) {
  const me = await requireUser();
  const admin = createAdmin();

  const { data: tarea } = await admin
    .from("tasks")
    .select("id, titulo, cliente:clients(nombre)")
    .eq("id", taskId)
    .maybeSingle();
  if (!tarea) return { error: "No encontré esa tarea." };

  const { error } = await admin.from("task_change_requests").insert({
    task_id: taskId,
    solicitante_id: me.id,
    motivo,
    detalle: detalle.trim().slice(0, 1000) || null,
  });
  if (error) {
    if (error.code === "23505")
      return { error: "Ya hay un pedido abierto en esta tarea. Coordinación lo está mirando." };
    if (error.code === "42P01")
      return { error: "Falta aplicar la migración 0154 en Supabase." };
    return { error: error.message };
  }

  // Aviso a quien puede resolverlo.
  const { data: coords } = await admin
    .from("users")
    .select("id, rol, rol_secundario")
    .eq("activo", true);
  const destinatarios = ((coords ?? []) as { id: string; rol: string; rol_secundario: string | null }[])
    .filter((u) => ROLES_QUE_RESUELVEN.includes(u.rol) || ROLES_QUE_RESUELVEN.includes(u.rol_secundario ?? ""))
    .map((u) => u.id)
    .filter((id) => id !== me.id);

  if (destinatarios.length > 0) {
    const t = tarea as unknown as { titulo: string; cliente: { nombre: string } | null };
    await admin.from("notifications").insert(
      destinatarios.map((uid) => ({
        user_id: uid,
        tipo: "recordatorio" as const,
        mensaje: mensajeParaCoordinacion({
          quien: me.nombre,
          motivo,
          tarea: t.titulo,
          cuenta: t.cliente?.nombre ?? null,
        }),
        link: `/tareas/${taskId}`,
        task_id: taskId,
      })),
    );
  }

  invalidate(taskId);
  return { ok: true as const, avisados: destinatarios.length };
}

/**
 * Resolver el pedido. `accion` es lo que se hace con la tarea en el mismo
 * paso: sin esto habría que aprobar acá y después ir a arreglar la tarea a
 * mano, que es exactamente lo que no se hace nunca.
 */
export async function resolverPedido(
  pedidoId: string,
  aprobada: boolean,
  opts: {
    nota?: string;
    accion?: "nada" | "reasignar" | "archivar" | "correr_fecha";
    nuevoAsignadoId?: string | null;
    nuevaFecha?: string | null;
  } = {},
) {
  const me = await requireUser();
  if (!userInRoles(me, ROLES_QUE_RESUELVEN))
    return { error: "Solo coordinación o dirección pueden resolver los pedidos." };

  const admin = createAdmin();
  const { data: pedido } = await admin
    .from("task_change_requests")
    .select("id, task_id, solicitante_id, motivo, estado")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!pedido) return { error: "No encontré ese pedido." };
  const p = pedido as { id: string; task_id: string; solicitante_id: string; estado: string };
  if (p.estado !== "pendiente") return { error: "Ese pedido ya estaba resuelto." };

  const { data: tarea } = await admin
    .from("tasks")
    .select("id, titulo")
    .eq("id", p.task_id)
    .maybeSingle();

  // Lo que se hace con la tarea, en el mismo clic.
  if (aprobada) {
    const patch: Record<string, unknown> = {};
    if (opts.accion === "reasignar" && opts.nuevoAsignadoId) patch.asignado_a_id = opts.nuevoAsignadoId;
    if (opts.accion === "archivar") patch.estado = "archivada";
    if (opts.accion === "correr_fecha" && opts.nuevaFecha) patch.fecha_limite = opts.nuevaFecha;
    if (Object.keys(patch).length > 0) await admin.from("tasks").update(patch).eq("id", p.task_id);
  }

  await admin
    .from("task_change_requests")
    .update({
      estado: aprobada ? "aprobada" : "rechazada",
      resuelto_por_id: me.id,
      resolucion_nota: opts.nota?.trim().slice(0, 500) || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", pedidoId);

  // Avisarle al que reportó: si no, la próxima vez no reporta.
  if (p.solicitante_id !== me.id) {
    await admin.from("notifications").insert({
      user_id: p.solicitante_id,
      tipo: "recordatorio",
      mensaje: mensajeParaSolicitante({
        aprobada,
        tarea: (tarea as { titulo: string } | null)?.titulo ?? "la tarea",
        nota: opts.nota,
      }),
      link: `/tareas/${p.task_id}`,
      task_id: p.task_id,
    });
  }

  invalidate(p.task_id);
  return { ok: true as const };
}

/** Los pedidos abiertos, para el panel de coordinación. */
export async function pedidosPendientes() {
  const me = await requireUser();
  if (!userInRoles(me, ROLES_QUE_RESUELVEN)) return [];
  const admin = createAdmin();
  const { data, error } = await admin
    .from("task_change_requests")
    .select(
      "id, motivo, detalle, created_at, task_id, solicitante:users!task_change_requests_solicitante_id_fkey(nombre), tarea:tasks(titulo, area, asignado_a_id, cliente:clients(nombre))",
    )
    .eq("estado", "pendiente")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => {
    const x = r as unknown as {
      id: string;
      motivo: string;
      detalle: string | null;
      created_at: string;
      task_id: string;
      solicitante: { nombre: string } | null;
      tarea: { titulo: string; area: string | null; cliente: { nombre: string } | null } | null;
    };
    return {
      id: x.id,
      motivo: x.motivo,
      motivoLabel: motivoMeta(x.motivo).label,
      sugerencia: motivoMeta(x.motivo).sugerencia,
      detalle: x.detalle,
      creadoEl: x.created_at,
      taskId: x.task_id,
      quien: x.solicitante?.nombre ?? "—",
      tarea: x.tarea?.titulo ?? "—",
      area: x.tarea?.area ?? null,
      cuenta: x.tarea?.cliente?.nombre ?? null,
    };
  });
}
