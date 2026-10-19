/** El ejecutor de «Tu lunes en 1 minuto» (ver tu-lunes.ts). Va en el cron diario; solo actúa los lunes. */
import { createAdmin } from "@/lib/supabase/admin";
import { computeAccountHealth } from "@/lib/director/health";
import { rachaDias, type TareaRacha } from "@/lib/racha";
import { sendPushToUsers } from "@/lib/push";
import { PREFIJO_LUNES, textoLunes } from "./tu-lunes";

type Admin = ReturnType<typeof createAdmin>;

const sumarDias = (ymd: string, d: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);

export async function runTuLunes(admin: Admin, hoy: string, opts: { forzar?: boolean; soloTexto?: boolean } = {}) {
  const lunes = new Date(`${hoy}T12:00:00Z`).getUTCDay() === 1;
  if (!lunes && !opts.forzar) return { enviado: false, motivo: "no es lunes" };
  const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data: usRaw } = await admin.from("users").select("id, nombre, rol, area").eq("activo", true);
  const users = (usRaw ?? []) as { id: string; nombre: string; rol: string; area: string | null }[];
  const dueno = users.find((u) => u.rol === "admin" && u.area === "Estrategia/Dirección") ?? users.find((u) => u.rol === "admin");
  if (!dueno) return { enviado: false, motivo: "sin dueño" };

  const [salud, { count: hechas }, { count: agendadas }, { data: satRaw }, { data: webRaw }, { count: trabadas }, { data: tRaw }] =
    await Promise.all([
      computeAccountHealth(admin),
      admin.from("client_meetings").select("id", { count: "exact", head: true }).gte("created_at", hace7),
      admin.from("internal_meetings").select("id", { count: "exact", head: true }).like("titulo", "Reunión mensual%").gte("starts_at", new Date().toISOString()),
      admin.from("client_satisfaction").select("puntaje, cliente:clients(nombre)").gte("created_at", hace7),
      admin.from("web_eventos").select("tipo").gte("created_at", hace7).limit(20000),
      admin.from("tasks").select("id", { count: "exact", head: true }).not("bloqueo", "is", null).not("estado", "in", "(completada,archivada)"),
      admin.from("tasks").select("asignado_a_id, fecha_limite, estado, fecha_completada, bloqueo").gte("fecha_limite", sumarDias(hoy, -90)).not("asignado_a_id", "is", null),
    ]);

  const sat = (satRaw ?? []) as unknown as { puntaje: number; cliente: { nombre: string } | null }[];
  const web = ((webRaw ?? []) as { tipo: string }[]).map((x) => x.tipo);
  const cuenta = (t: string) => web.filter((x) => x === t).length;

  // La racha más larga del equipo (sin contar a la dirección).
  const porPersona = new Map<string, TareaRacha[]>();
  for (const t of (tRaw ?? []) as (TareaRacha & { asignado_a_id: string })[]) {
    porPersona.set(t.asignado_a_id, [...(porPersona.get(t.asignado_a_id) ?? []), t]);
  }
  let mejorRacha: { nombre: string; dias: number } | null = null;
  for (const u of users.filter((x) => x.rol !== "admin")) {
    const dias = rachaDias(porPersona.get(u.id) ?? [], hoy);
    if (dias > (mejorRacha?.dias ?? 0)) mejorRacha = { nombre: u.nombre.split(" ")[0], dias };
  }

  const mensaje = textoLunes({
    rojas: salud.cuentas.filter((c) => c.semaforo === "mal").map((c) => c.nombre),
    regulares: salud.resumen.regular,
    bien: salud.resumen.bien,
    reunionesHechas: hechas ?? 0,
    reunionesAgendadas: agendadas ?? 0,
    encuestas: {
      cantidad: sat.length,
      promedio: sat.length ? sat.reduce((a, s) => a + s.puntaje, 0) / sat.length : null,
      bajas: sat.filter((s) => s.puntaje <= 3).map((s) => s.cliente?.nombre ?? "?"),
    },
    web: { visitas: cuenta("visita"), whatsapp: cuenta("whatsapp"), diagnosticos: cuenta("diagnostico"), formularios: cuenta("formulario") },
    trabadas: trabadas ?? 0,
    mejorRacha,
  });
  if (opts.soloTexto) return { enviado: false, mensaje };

  const inicioDia = new Date(`${hoy}T00:00:00-03:00`).toISOString();
  const { data: ya } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", dueno.id)
    .gte("created_at", inicioDia)
    .like("mensaje", `${PREFIJO_LUNES}%`)
    .limit(1);
  if (ya?.length) return { enviado: false, motivo: "ya enviado hoy" };
  await admin.from("notifications").insert({ user_id: dueno.id, task_id: null, tipo: "recordatorio", mensaje, link: "/direccion" });
  await sendPushToUsers([dueno.id], { title: "☀️ Tu lunes en 1 minuto", body: mensaje.slice(PREFIJO_LUNES.length + 1, 240), url: "/direccion", tag: `lunes-${hoy}` }).catch(() => undefined);
  return { enviado: true, mensaje };
}
