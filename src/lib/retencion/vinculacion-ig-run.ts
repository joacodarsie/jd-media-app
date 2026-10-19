/**
 * La alarma diaria de cuentas sin medir (19/10/2026). Va en el cron de la
 * mañana, después de sincronizar Instagram:
 * - cada cuenta activa con redes o pauta que no trajo datos en 3 días tiene
 *   UNA tarea abierta para su media buyer (o paid media, o la PM);
 * - todos los días le llega un aviso a esas personas y al dueño;
 * - cuando llegan los datos, la tarea se cierra sola.
 * La lógica de quién está sin medir vive en `vinculacion-ig.ts` (testeada).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AREA_PM } from "@/lib/tareas/puerta";
import { sendPushToUsers } from "@/lib/push";
import { avisoSinMedir, cuentasSinMedir, PREFIJO_AVISO_IG, tareaVincular } from "./vinculacion-ig";

const sumarDias = (ymd: string, d: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);

export async function runAlarmaVinculacion(
  admin: SupabaseClient,
  hoy: string,
  opts: { soloCalcular?: boolean } = {}
): Promise<{ sinMedir: string[]; tareasNuevas: string[]; cerradas: number; avisados: number }> {
  const { data: cRaw } = await admin
    .from("clients")
    .select("id, nombre, fecha_inicio, ig_username, media_buyer_id")
    .eq("estado", "activo")
    .eq("es_interno", false);
  const clientes = (cRaw ?? []) as { id: string; nombre: string; fecha_inicio: string | null; ig_username: string | null; media_buyer_id: string | null }[];
  const ids = clientes.map((c) => c.id);

  const [{ data: svcRaw }, { data: snapRaw }] = await Promise.all([
    admin.from("client_services").select("cliente_id, tipo").eq("activo", true).in("cliente_id", ids).in("tipo", ["gestion_redes", "paid_media"]),
    admin.from("ig_snapshots").select("cliente_id").gte("fecha", sumarDias(hoy, -3)).in("cliente_id", ids),
  ]);
  const necesitan = new Set(((svcRaw ?? []) as { cliente_id: string }[]).map((s) => s.cliente_id));
  const conDatos = new Set(((snapRaw ?? []) as { cliente_id: string }[]).map((s) => s.cliente_id));

  const lista = cuentasSinMedir(
    clientes.map((c) => ({ id: c.id, nombre: c.nombre, fechaInicio: c.fecha_inicio, igUsername: c.ig_username, necesitaInstagram: necesitan.has(c.id) })),
    conDatos,
    hoy
  );
  const r = { sinMedir: lista.map((x) => x.nombre), tareasNuevas: [] as string[], cerradas: 0, avisados: 0 };
  if (opts.soloCalcular) return r;

  // Las que ya traen datos: su tarea se da por hecha sola.
  const medidas = clientes.filter((c) => conDatos.has(c.id)).map((c) => `vincular-ig:${c.id}`);
  if (medidas.length) {
    const { data: cerradas } = await admin
      .from("tasks")
      .update({ estado: "completada" })
      .in("rutina_key", medidas)
      .not("estado", "in", "(completada,archivada)")
      .select("id");
    r.cerradas = cerradas?.length ?? 0;
  }
  if (!lista.length) return r;

  const { data: usersRaw } = await admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true);
  const users = (usersRaw ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const activos = new Set(users.map((u) => u.id));
  const paid = users.find((u) => u.rol === "paid_media" || u.area === "Paid Media" || u.area_secundaria === "Paid Media")?.id;
  const pm = users.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id;
  const dueno = users.find((u) => u.rol === "admin")?.id;
  const quienDe = (id: string) => {
    const mb = clientes.find((c) => c.id === id)?.media_buyer_id;
    return (mb && activos.has(mb) ? mb : null) ?? paid ?? pm ?? dueno ?? null;
  };

  // Una tarea abierta por cuenta; si se cerró a mano sin estar medida, se reabre.
  const claves = lista.map((x) => `vincular-ig:${x.id}`);
  const { data: yaRaw } = await admin.from("tasks").select("id, rutina_key, estado").in("rutina_key", claves);
  const ya = new Map(((yaRaw ?? []) as { id: string; rutina_key: string; estado: string }[]).map((t) => [t.rutina_key, t]));
  for (const x of lista) {
    const k = `vincular-ig:${x.id}`;
    const t = ya.get(k);
    if (t && t.estado !== "completada" && t.estado !== "archivada") continue;
    if (t) {
      await admin.from("tasks").update({ estado: "pendiente", fecha_limite: sumarDias(hoy, 1), prioridad: "urgente" }).eq("id", t.id);
      continue;
    }
    const quien = quienDe(x.id);
    if (!quien) continue;
    const { titulo, descripcion } = tareaVincular(x);
    const { error } = await admin.from("tasks").insert({
      titulo,
      descripcion,
      cliente_id: x.id,
      asignado_a_id: quien,
      creado_por_id: dueno ?? quien,
      area: "Paid Media",
      prioridad: "alta",
      estado: "pendiente",
      fecha_limite: sumarDias(hoy, 2),
      rutina_key: k,
    });
    if (!error) r.tareasNuevas.push(x.nombre);
  }

  // El aviso de todos los días: a quienes tienen cuentas sin medir y al dueño.
  const mensaje = avisoSinMedir(lista);
  const destinatarios = [...new Set([...lista.map((x) => quienDe(x.id)), dueno].filter((x): x is string => !!x))];
  const inicioDia = new Date(`${hoy}T00:00:00-03:00`).toISOString();
  const { data: avisadosHoy } = await admin
    .from("notifications")
    .select("user_id")
    .in("user_id", destinatarios)
    .gte("created_at", inicioDia)
    .like("mensaje", `${PREFIJO_AVISO_IG}%`);
  const yaAvisados = new Set(((avisadosHoy ?? []) as { user_id: string }[]).map((n) => n.user_id));
  const nuevos = destinatarios.filter((u) => !yaAvisados.has(u));
  if (mensaje && nuevos.length) {
    await admin.from("notifications").insert(
      nuevos.map((user_id) => ({ user_id, task_id: null, tipo: "recordatorio", mensaje, link: "/clientes/conectar-instagram" }))
    );
    await sendPushToUsers(nuevos, {
      title: `🔗 ${lista.length} cuenta${lista.length === 1 ? "" : "s"} sin medir Instagram`,
      body: lista.slice(0, 4).map((x) => x.nombre).join(", "),
      url: "/clientes/conectar-instagram",
      tag: `sin-medir-${hoy}`,
    }).catch(() => undefined);
    r.avisados = nuevos.length;
  }
  return r;
}
