/**
 * Aplica las reasignaciones de tareas cuando cambia el equipo de una cuenta.
 * Ver el porqué en `reasignar.ts`. Best-effort: si algo falla, NO rompe el
 * guardado de la ficha del cliente — es una consecuencia, no la operación.
 */
import { createAdmin } from "@/lib/supabase/admin";
import { calcularReasignaciones, agruparPorPersona, type EquipoDeCuenta } from "./reasignar";

type Admin = ReturnType<typeof createAdmin>;

export async function reasignarTareasDeCuenta(
  clienteId: string,
  opts: { admin?: Admin; avisar?: boolean } = {},
): Promise<{ movidas: number }> {
  const admin = opts.admin ?? createAdmin();
  try {
    const [{ data: cliente }, { data: tareas }, { data: users }] = await Promise.all([
      admin
        .from("clients")
        .select("id, nombre, disenador_id, cm_id, audiovisual_id, media_buyer_id")
        .eq("id", clienteId)
        .maybeSingle(),
      admin
        .from("tasks")
        .select("id, area, asignado_a_id")
        .eq("cliente_id", clienteId)
        .not("estado", "in", "(completada,archivada)"),
      admin.from("users").select("id").eq("activo", true),
    ]);
    if (!cliente) return { movidas: 0 };

    const activas = new Set(((users ?? []) as { id: string }[]).map((u) => u.id));
    const rs = calcularReasignaciones(
      (tareas ?? []) as { id: string; area: string | null; asignado_a_id: string | null }[],
      cliente as EquipoDeCuenta,
      activas,
    );
    if (rs.length === 0) return { movidas: 0 };

    const porPersona = agruparPorPersona(rs);
    for (const [uid, ids] of porPersona) {
      for (let i = 0; i < ids.length; i += 50)
        await admin.from("tasks").update({ asignado_a_id: uid }).in("id", ids.slice(i, i + 50));
    }

    // Avisarle a quien recibe trabajo nuevo: si no, se entera cuando el cliente
    // reclama.
    if (opts.avisar !== false) {
      const nombre = (cliente as { nombre: string }).nombre;
      await admin.from("notifications").insert(
        [...porPersona].map(([uid, ids]) => ({
          user_id: uid,
          tipo: "asignacion",
          mensaje: `📋 Pasaron a tu nombre ${ids.length} tarea${ids.length === 1 ? "" : "s"} de ${nombre} (cambió el equipo de la cuenta).`,
          link: "/tareas",
          task_id: null,
        })),
      );
    }
    return { movidas: rs.length };
  } catch {
    return { movidas: 0 };
  }
}
