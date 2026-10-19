/** El ejecutor de las cuentas en rojo (ver cuentas-rojo.ts). Va en el cron diario. */
import { createAdmin } from "@/lib/supabase/admin";
import { computeAccountHealth } from "@/lib/director/health";
import { AREA_PM } from "@/lib/tareas/puerta";
import { claveRojo, MAX_TAREAS_ROJO, tareaRojo } from "./cuentas-rojo";

type Admin = ReturnType<typeof createAdmin>;

export async function runCuentasEnRojo(admin: Admin, hoy: string): Promise<{ rojas: string[]; creadas: number; cerradas: number }> {
  const periodo = hoy.slice(0, 7);
  const { cuentas } = await computeAccountHealth(admin);
  // Solo las más en riesgo (19/10/2026: con los criterios de hoy 19 de 20 dan
  // rojo, y 19 tareas urgentes no las mira nadie). Ya vienen ordenadas peor primero.
  const rojas = cuentas.filter((c) => c.semaforo === "mal").slice(0, MAX_TAREAS_ROJO);
  const r = { rojas: rojas.map((c) => c.nombre), creadas: 0, cerradas: 0 };

  // Las que salieron del rojo: su tarea se da por hecha.
  const noRojas = cuentas.filter((c) => c.semaforo !== "mal").map((c) => claveRojo(c.id, periodo));
  if (noRojas.length) {
    const { data } = await admin
      .from("tasks")
      .update({ estado: "completada" })
      .in("rutina_key", noRojas)
      .not("estado", "in", "(completada,archivada)")
      .select("id");
    r.cerradas = data?.length ?? 0;
  }
  if (!rojas.length) return r;

  const ids = rojas.map((c) => c.id);
  const [{ data: cRaw }, { data: uRaw }, { data: yaRaw }] = await Promise.all([
    admin.from("clients").select("id, responsable_id").in("id", ids),
    admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true),
    admin.from("tasks").select("id, rutina_key, estado").in("rutina_key", ids.map((id) => claveRojo(id, periodo))),
  ]);
  const users = (uRaw ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const activos = new Set(users.map((u) => u.id));
  const pm = users.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id ?? null;
  const dueno = users.find((u) => u.rol === "admin")?.id ?? null;
  const respDe = new Map(((cRaw ?? []) as { id: string; responsable_id: string | null }[]).map((c) => [c.id, c.responsable_id]));
  const ya = new Map(((yaRaw ?? []) as { id: string; rutina_key: string; estado: string }[]).map((t) => [t.rutina_key, t]));
  const manana = new Date(Date.parse(`${hoy}T12:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);

  for (const c of rojas) {
    const clave = claveRojo(c.id, periodo);
    const t = tareaRojo(c.nombre, c.alertas);
    const existente = ya.get(clave);
    if (existente) {
      // Abierta: se le actualizan los motivos. Si se cerró a mano y sigue en
      // rojo, se reabre.
      const abierta = existente.estado !== "completada" && existente.estado !== "archivada";
      await admin
        .from("tasks")
        .update(abierta ? { descripcion: t.descripcion } : { descripcion: t.descripcion, estado: "pendiente", fecha_limite: manana })
        .eq("id", existente.id);
      continue;
    }
    const resp = respDe.get(c.id);
    const quien = (resp && activos.has(resp) ? resp : null) ?? pm ?? dueno;
    if (!quien) continue;
    const fila = {
      titulo: t.titulo,
      descripcion: t.descripcion,
      cliente_id: c.id,
      asignado_a_id: quien,
      creado_por_id: dueno ?? quien,
      area: AREA_PM,
      prioridad: "urgente",
      estado: "pendiente",
      fecha_limite: manana,
      rutina_key: clave,
    };
    const colaboradores = pm && pm !== quien ? [pm] : [];
    let { error } = await admin.from("tasks").insert({ ...fila, colaboradores });
    if (error && /colaboradores/.test(error.message)) ({ error } = await admin.from("tasks").insert(fila));
    if (!error) r.creadas++;
  }
  return r;
}
