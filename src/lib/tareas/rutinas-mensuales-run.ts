/**
 * El ejecutor de las rutinas del mes: mira quién ocupa cada puesto, crea las
 * tareas que faltan y no toca las que ya están.
 *
 * La decisión de QUÉ tareas van vive en `rutinas-mensuales.ts` (puro y
 * testeado); acá solo se habla con la base.
 *
 * Idempotente por `tasks.rutina_key` (único, migración 0181): lo puede llamar
 * el cron del día 1 y también el cron diario sin crear nada dos veces.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { rutinasDelMes, type GenteRutina } from "./rutinas-mensuales";

const AREA_COORD_GENERAL = "Coordinación General";

export async function runRutinasMensuales(
  admin: SupabaseClient,
  periodo: string
): Promise<{ periodo: string; creadas: number; yaEstaban: number }> {
  const { data: usersRaw } = await admin
    .from("users")
    .select("id, rol, area, area_secundaria, created_at")
    .eq("activo", true)
    .order("created_at", { ascending: true });

  const users = (usersRaw ?? []) as {
    id: string;
    rol: string;
    area: string | null;
    area_secundaria: string | null;
  }[];
  const porArea = (area: string) =>
    users.find((u) => u.area === area || u.area_secundaria === area)?.id ?? null;

  const gente: GenteRutina = {
    coordGeneralId: porArea(AREA_COORD_GENERAL),
    adminId: users.find((u) => u.rol === "admin")?.id ?? null,
  };

  const tareas = rutinasDelMes(periodo, gente);
  if (tareas.length === 0) return { periodo, creadas: 0, yaEstaban: 0 };

  // Las que ya existen no se tocan: puede que alguien les haya cambiado la
  // fecha o el responsable, y pisarlas sería deshacer ese trabajo.
  const { data: yaEstan } = await admin
    .from("tasks")
    .select("rutina_key")
    .in(
      "rutina_key",
      tareas.map((t) => t.rutina_key)
    );
  const existentes = new Set(
    ((yaEstan ?? []) as { rutina_key: string }[]).map((r) => r.rutina_key)
  );

  const nuevas = tareas.filter((t) => !existentes.has(t.rutina_key));
  if (nuevas.length === 0) return { periodo, creadas: 0, yaEstaban: existentes.size };

  const { error } = await admin.from("tasks").insert(
    nuevas.map((t) => ({
      titulo: t.titulo,
      descripcion: t.descripcion,
      asignado_a_id: t.asignado_a_id,
      creado_por_id: gente.adminId,
      cliente_id: t.cliente_id,
      area: t.area,
      prioridad: t.prioridad,
      estado: "pendiente",
      fecha_limite: t.fecha_limite,
      rutina_key: t.rutina_key,
    }))
  );
  if (error) throw new Error(error.message);

  return { periodo, creadas: nuevas.length, yaEstaban: existentes.size };
}
