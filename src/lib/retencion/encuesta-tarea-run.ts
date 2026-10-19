/** El ejecutor de la tarea de la encuesta del mes (ver encuesta-tarea.ts). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AREA_PM } from "@/lib/tareas/puerta";
import { periodLabel } from "@/lib/finanzas";
import { faltanEncuesta, tareaEncuesta } from "./encuesta-tarea";

export async function runTareaEncuesta(admin: SupabaseClient, hoy: string): Promise<{ faltan: number; accion: string }> {
  const periodo = hoy.slice(0, 7);
  const clave = `encuesta:${periodo}`;
  const [{ data: cRaw }, { data: sRaw, error: sErr }, { data: tRaw }] = await Promise.all([
    admin.from("clients").select("id, nombre, fecha_inicio").eq("estado", "activo").eq("es_interno", false),
    admin.from("client_satisfaction").select("cliente_id").eq("periodo", periodo),
    admin.from("tasks").select("id, estado").eq("rutina_key", clave).limit(1),
  ]);
  if (sErr) return { faltan: 0, accion: "sin tabla" };
  const cuentas = ((cRaw ?? []) as { id: string; nombre: string; fecha_inicio: string | null }[]).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    fechaInicio: c.fecha_inicio,
  }));
  const faltan = faltanEncuesta(cuentas, new Set(((sRaw ?? []) as { cliente_id: string }[]).map((s) => s.cliente_id)), hoy);
  const ya = ((tRaw ?? []) as { id: string; estado: string }[])[0];
  const t = tareaEncuesta(periodLabel(periodo).toLowerCase(), faltan);

  if (ya) {
    if (ya.estado === "completada" || ya.estado === "archivada") return { faltan: faltan.length, accion: "cerrada" };
    if (!faltan.length) {
      await admin.from("tasks").update({ estado: "completada" }).eq("id", ya.id);
      return { faltan: 0, accion: "completada" };
    }
    // La lista de las que faltan se mantiene al día.
    await admin.from("tasks").update({ descripcion: t.descripcion }).eq("id", ya.id);
    return { faltan: faltan.length, accion: "actualizada" };
  }
  if (!faltan.length) return { faltan: 0, accion: "nada" };

  const { data: uRaw } = await admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true);
  const users = (uRaw ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const pm = users.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id;
  const dueno = users.find((u) => u.rol === "admin")?.id;
  const quien = pm ?? dueno;
  if (!quien) return { faltan: faltan.length, accion: "sin responsable" };
  const finDeMes = new Date(Date.UTC(Number(periodo.slice(0, 4)), Number(periodo.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const limite = hoy.slice(8, 10) < "22" ? `${periodo}-22` : finDeMes;
  const { error } = await admin.from("tasks").insert({
    titulo: t.titulo,
    descripcion: t.descripcion,
    asignado_a_id: quien,
    creado_por_id: dueno ?? quien,
    area: AREA_PM,
    prioridad: "alta",
    estado: "pendiente",
    fecha_limite: limite,
    rutina_key: clave,
  });
  return { faltan: faltan.length, accion: error ? `error: ${error.message}` : "creada" };
}
