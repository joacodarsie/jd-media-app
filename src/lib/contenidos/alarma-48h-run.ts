/** El ejecutor de la alarma 48 h (ver alarma-48h.ts). Va en el cron diario. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AREA_PM } from "@/lib/tareas/puerta";
import { isClientPausedFor } from "@/lib/client-pause";
import { sendPushToUsers } from "@/lib/push";
import { alarmaDe, avisoProducir, tareaAprobar } from "./alarma-48h";

const sumarDias = (ymd: string, d: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);

export async function runAlarma48h(admin: SupabaseClient, hoy: string): Promise<{ aprobar: number; producir: number; cerradas: number }> {
  const r = { aprobar: 0, producir: 0, cerradas: 0 };
  const { data: cRaw } = await admin
    .from("clients")
    .select("id, nombre, responsable_id, cm_id, pausas")
    .eq("estado", "activo")
    .eq("es_interno", false);
  const clientes = ((cRaw ?? []) as { id: string; nombre: string; responsable_id: string | null; cm_id: string | null; pausas: string[] | null }[]).filter(
    (c) => !isClientPausedFor(c.pausas, hoy.slice(0, 7))
  );
  const porId = new Map(clientes.map((c) => [c.id, c]));
  if (!clientes.length) return r;

  const { data: pRaw } = await admin
    .from("publications")
    .select("id, titulo, estado, fecha_publicacion, cliente_id, task_id")
    .in("cliente_id", [...porId.keys()])
    .gte("fecha_publicacion", hoy)
    .lt("fecha_publicacion", sumarDias(hoy, 3))
    .in("estado", ["idea", "revision_creativa", "guion", "en_diseno", "edicion"]);
  const piezas = (pRaw ?? []) as { id: string; titulo: string | null; estado: string; fecha_publicacion: string; cliente_id: string; task_id: string | null }[];

  // Las tareas de «aprobar ya» cuya pieza ya avanzó (o ya pasó): se cierran solas.
  const enAlarma = new Set(piezas.filter((p) => alarmaDe(p, hoy) === "aprobar").map((p) => `aprobar-ya:${p.id}`));
  const { data: abiertas } = await admin
    .from("tasks")
    .select("id, rutina_key")
    .like("rutina_key", "aprobar-ya:%")
    .not("estado", "in", "(completada,archivada)");
  const cerrar = ((abiertas ?? []) as { id: string; rutina_key: string }[]).filter((t) => !enAlarma.has(t.rutina_key)).map((t) => t.id);
  if (cerrar.length) {
    await admin.from("tasks").update({ estado: "completada" }).in("id", cerrar);
    r.cerradas = cerrar.length;
  }

  const { data: uRaw } = await admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true);
  const users = (uRaw ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const activos = new Set(users.map((u) => u.id));
  const pm = users.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id ?? null;
  const { data: yaRaw } = await admin.from("tasks").select("rutina_key").in("rutina_key", [...enAlarma]);
  const ya = new Set(((yaRaw ?? []) as { rutina_key: string }[]).map((t) => t.rutina_key));

  for (const p of piezas) {
    const tipo = alarmaDe(p, hoy);
    const c = porId.get(p.cliente_id);
    if (!tipo || !c) continue;
    const datos = { titulo: p.titulo || "Pieza sin título", cuenta: c.nombre, fecha: p.fecha_publicacion, hoy, estado: p.estado };

    if (tipo === "aprobar") {
      const clave = `aprobar-ya:${p.id}`;
      if (ya.has(clave)) continue;
      const quien = (c.responsable_id && activos.has(c.responsable_id) ? c.responsable_id : null) ?? pm;
      if (!quien) continue;
      const t = tareaAprobar(datos);
      const fila = {
        titulo: t.titulo,
        descripcion: t.descripcion,
        cliente_id: c.id,
        asignado_a_id: quien,
        creado_por_id: quien,
        area: "Estrategia/Dirección",
        prioridad: "urgente",
        estado: "pendiente",
        fecha_limite: hoy,
        rutina_key: clave,
      };
      const colaboradores = c.cm_id && c.cm_id !== quien && activos.has(c.cm_id) ? [c.cm_id] : [];
      let { error } = await admin.from("tasks").insert({ ...fila, colaboradores });
      if (error && /colaboradores/.test(error.message)) ({ error } = await admin.from("tasks").insert(fila));
      if (!error) r.aprobar++;
      continue;
    }

    // Producir: su tarea pasa a urgente y se avisa una sola vez.
    if (!p.task_id) continue;
    const { data: tRaw } = await admin.from("tasks").select("id, asignado_a_id, prioridad, estado").eq("id", p.task_id).maybeSingle();
    const t = tRaw as { id: string; asignado_a_id: string | null; prioridad: string; estado: string } | null;
    if (!t || t.prioridad === "urgente" || t.estado === "completada" || t.estado === "archivada") continue;
    await admin.from("tasks").update({ prioridad: "urgente" }).eq("id", t.id);
    if (t.asignado_a_id) {
      const mensaje = avisoProducir(datos);
      await admin.from("notifications").insert({ user_id: t.asignado_a_id, task_id: t.id, tipo: "recordatorio", mensaje, link: `/tareas/${t.id}` });
      await sendPushToUsers([t.asignado_a_id], { title: "⏰ Pieza que sale ya", body: mensaje, url: `/tareas/${t.id}`, tag: `48h-${p.id}` }).catch(() => undefined);
    }
    r.producir++;
  }
  return r;
}
