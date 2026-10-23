/** Lo que habla con la base para las piezas congeladas (ver congeladas.ts). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { AREA_PM } from "@/lib/tareas/puerta";
import { avisoCongeladas, piezasCongeladas, porResponsable, VENTANA_DIAS, type GrupoCongeladas, type PiezaParaCongelar } from "./congeladas";

export async function cargarCongeladas(admin: SupabaseClient, hoy: string): Promise<GrupoCongeladas[]> {
  const hasta = new Date(Date.parse(`${hoy}T12:00:00Z`) + VENTANA_DIAS * 86_400_000).toISOString().slice(0, 10);
  const { data: pRaw } = await admin
    .from("publications")
    .select(
      "titulo, fecha_publicacion, updated_at, frenado_cliente, estado, cliente:clients(nombre, estado), tarea:tasks!publications_task_id_fkey(id, estado, created_at, bloqueo, asignado_a_id, asignado:users!tasks_asignado_a_id_fkey(nombre))"
    )
    .not("estado", "in", "(publicado,rechazado,idea)")
    .not("task_id", "is", null)
    .lte("fecha_publicacion", `${hasta}T23:59:59`);
  type Fila = {
    titulo: string;
    fecha_publicacion: string;
    updated_at: string;
    frenado_cliente: boolean | null;
    cliente: { nombre: string; estado: string } | null;
    tarea: { id: string; estado: string; created_at: string; bloqueo: string | null; asignado_a_id: string | null; asignado: { nombre: string } | null } | null;
  };
  const filas = ((pRaw ?? []) as unknown as Fila[]).filter(
    (f) => f.cliente?.estado === "activo" && f.tarea && ["pendiente", "en_progreso", "en_revision"].includes(f.tarea.estado)
  );
  if (!filas.length) return [];

  const ids = filas.map((f) => f.tarea!.id);
  const ultimo = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("task_history").select("task_id, created_at").in("task_id", ids.slice(i, i + 200));
    for (const h of (data ?? []) as { task_id: string; created_at: string }[]) {
      if (!ultimo.has(h.task_id) || h.created_at > ultimo.get(h.task_id)!) ultimo.set(h.task_id, h.created_at);
    }
  }

  const piezas: PiezaParaCongelar[] = filas.map((f) => {
    const t = f.tarea!;
    const movs = [t.created_at, f.updated_at, ultimo.get(t.id)].filter(Boolean) as string[];
    return {
      taskId: t.id,
      titulo: f.titulo,
      cuenta: f.cliente!.nombre,
      fecha: f.fecha_publicacion.slice(0, 10),
      responsableId: t.asignado_a_id,
      responsable: t.asignado?.nombre ?? null,
      ultimoMovimiento: movs.sort().pop()!,
      bloqueada: !!t.bloqueo || !!f.frenado_cliente,
    };
  });
  return porResponsable(piezasCongeladas(piezas, hoy));
}

/** Un aviso por día a la PM y a dirección con el resumen. */
export async function runAvisoCongeladas(admin: SupabaseClient, hoy: string): Promise<{ total: number; avisados: number }> {
  const grupos = await cargarCongeladas(admin, hoy);
  const mensaje = avisoCongeladas(grupos);
  const total = grupos.reduce((n, g) => n + g.piezas.length, 0);
  if (!mensaje) return { total: 0, avisados: 0 };
  const { data: uRaw } = await admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true);
  const destinatarios = ((uRaw ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[])
    .filter((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)
    .map((u) => u.id);
  const inicioHoy = toZonedTime(new Date(`${formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd")}T00:00:00`), TIMEZONE).toISOString();
  let avisados = 0;
  for (const id of destinatarios) {
    const { data: ya } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", id)
      .eq("link", "/dashboard#congeladas")
      .gte("created_at", inicioHoy)
      .limit(1);
    if (ya?.length) continue;
    await admin.from("notifications").insert({ user_id: id, tipo: "recordatorio", mensaje, link: "/dashboard#congeladas" });
    avisados++;
  }
  return { total, avisados };
}
