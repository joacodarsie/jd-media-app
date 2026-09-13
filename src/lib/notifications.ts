import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIMEZONE } from "./constants";
import {
  avisoParaElDueno,
  avisoPersonal,
  resumirActividad,
  type ContactoActividad,
} from "./prospecting/actividad";
import {
  avisosDeRevisionCreativa,
  type CuentaParaRevision,
  type PiezaEnRevision,
} from "./contenidos/revision-creativa";

/** Roles de los que se espera que prospecten (los que reciben el aviso). */
const ROLES_PROSPECTAN = ["comercial", "prospecting", "coordinador", "admin"];

/**
 * Genera notificaciones in-app de "vencida" y "próxima a vencer" para las
 * tareas activas asignadas al usuario, evitando duplicados del mismo día.
 * Pensado para correr en el layout: barato y silencioso.
 */
export async function ensureDueNotifications(
  supabase: SupabaseClient,
  userId: string
) {
  const hoy = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const tomorrowDate = new Date(Date.now() + 86400000);
  const manana = formatInTimeZone(tomorrowDate, TIMEZONE, "yyyy-MM-dd");
  const inicioHoyCordoba = toZonedTime(new Date(hoy + "T00:00:00"), TIMEZONE);

  const { data: misTareas } = await supabase
    .from("tasks")
    .select("id, titulo, fecha_limite")
    .eq("asignado_a_id", userId)
    .neq("estado", "completada")
    .not("fecha_limite", "is", null);

  if (!misTareas || misTareas.length === 0) return;

  const taskIds = misTareas.map((t) => t.id);

  const { data: existentes } = await supabase
    .from("notifications")
    .select("task_id, tipo, created_at")
    .eq("user_id", userId)
    .in("task_id", taskIds)
    .in("tipo", ["vencida", "proxima_a_vencer"])
    .gte("created_at", inicioHoyCordoba.toISOString());

  const yaCreadas = new Set(
    (existentes ?? []).map((n) => `${n.task_id}:${n.tipo}`)
  );

  const nuevas: {
    user_id: string;
    task_id: string;
    tipo: string;
    mensaje: string;
  }[] = [];

  for (const t of misTareas) {
    const limite = (t.fecha_limite as string).slice(0, 10);
    if (limite < hoy) {
      const key = `${t.id}:vencida`;
      if (!yaCreadas.has(key))
        nuevas.push({
          user_id: userId,
          task_id: t.id,
          tipo: "vencida",
          mensaje: `Tarea vencida: "${t.titulo}"`,
        });
    } else if (limite === hoy || limite === manana) {
      const key = `${t.id}:proxima_a_vencer`;
      if (!yaCreadas.has(key))
        nuevas.push({
          user_id: userId,
          task_id: t.id,
          tipo: "proxima_a_vencer",
          mensaje:
            limite === hoy
              ? `Vence hoy: "${t.titulo}"`
              : `Vence mañana: "${t.titulo}"`,
        });
    }
  }

  if (nuevas.length) await supabase.from("notifications").insert(nuevas);
}

/**
 * Genera un recordatorio diario de finanzas para admins / usuarios con la
 * feature `finanzas`: avisa de cobros a clientes y pagos al equipo que están
 * atrasados o vencen esta semana. Un solo aviso resumido por persona por día
 * (no spamea aunque el cron corra varias veces). Corre en el cron diario.
 */
export async function ensureFinanceNotifications(admin: SupabaseClient) {
  const hoy = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const in7 = formatInTimeZone(
    new Date(Date.now() + 7 * 86400000),
    TIMEZONE,
    "yyyy-MM-dd"
  );
  const inicioHoyCordoba = toZonedTime(new Date(hoy + "T00:00:00"), TIMEZONE);

  // Destinatarios: admins + cualquiera con la feature `finanzas` otorgada.
  const { data: usersRaw } = await admin
    .from("users")
    .select("id, rol, permisos")
    .eq("activo", true);
  type URow = { id: string; rol: string; permisos: Record<string, boolean> | null };
  const recipients = ((usersRaw ?? []) as URow[])
    .filter((u) => u.rol === "admin" || u.permisos?.finanzas === true)
    .map((u) => u.id);
  if (recipients.length === 0) return;

  const [{ data: invoices }, { data: payments }] = await Promise.all([
    admin
      .from("client_invoices")
      .select("fecha_vencimiento")
      .is("fecha_cobro", null)
      .not("fecha_vencimiento", "is", null),
    admin
      .from("team_payments")
      .select("fecha_programada")
      .is("fecha_pago", null),
  ]);

  const inv = (invoices ?? []) as { fecha_vencimiento: string }[];
  const pay = (payments ?? []) as { fecha_programada: string }[];

  const cobVenc = inv.filter((i) => i.fecha_vencimiento < hoy).length;
  const cobSemana = inv.filter(
    (i) => i.fecha_vencimiento >= hoy && i.fecha_vencimiento <= in7
  ).length;
  const pagVenc = pay.filter((p) => p.fecha_programada < hoy).length;
  const pagSemana = pay.filter(
    (p) => p.fecha_programada >= hoy && p.fecha_programada <= in7
  ).length;

  if (cobVenc + cobSemana + pagVenc + pagSemana === 0) return;

  const parts: string[] = [];
  if (cobVenc) parts.push(`${cobVenc} cobro${cobVenc > 1 ? "s" : ""} atrasado${cobVenc > 1 ? "s" : ""}`);
  if (cobSemana) parts.push(`${cobSemana} cobro${cobSemana > 1 ? "s" : ""} esta semana`);
  if (pagVenc) parts.push(`${pagVenc} pago${pagVenc > 1 ? "s" : ""} al equipo atrasado${pagVenc > 1 ? "s" : ""}`);
  if (pagSemana) parts.push(`${pagSemana} pago${pagSemana > 1 ? "s" : ""} al equipo esta semana`);
  const mensaje = `💰 Finanzas: ${parts.join(" · ")}.`;

  // Un aviso por persona por día (dedup por tipo+link+fecha).
  for (const uid of recipients) {
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", uid)
      .eq("tipo", "recordatorio")
      .eq("link", "/cobros")
      .gte("created_at", inicioHoyCordoba.toISOString())
      .limit(1);
    if (existing && existing.length > 0) continue;
    await admin.from("notifications").insert({
      user_id: uid,
      tipo: "recordatorio",
      mensaje,
      link: "/cobros",
      task_id: null,
    });
  }
}

/**
 * Aviso diario de PROSPECCIÓN: a cada persona que prospecta le dice cuántos
 * mensajes lleva hoy contra la meta, y al dueño el resumen del equipo.
 *
 * Existe porque el problema nunca fue tener contactos —había 132 cargados— sino
 * que nadie les escribía: 1 solo contactado en 7 días. Un número que aparece
 * todos los días en la campana es lo que convierte eso en hábito. Dedup: un
 * aviso por persona por día, aunque el cron corra varias veces.
 */
export async function ensureProspectingNudges(admin: SupabaseClient) {
  const hoy = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const inicioHoyCordoba = toZonedTime(new Date(hoy + "T00:00:00"), TIMEZONE);

  const [{ data: usersRaw }, { data: contactosRaw }] = await Promise.all([
    admin.from("users").select("id, nombre, email, rol, rol_secundario").eq("activo", true),
    admin.from("prospecting_contacts").select("asignado_a, contactado_at, estado, reunion_at"),
  ]);

  type URow = {
    id: string;
    nombre: string;
    email: string | null;
    rol: string;
    rol_secundario: string | null;
  };
  const users = (usersRaw ?? []) as URow[];
  const prospectan = users
    .filter(
      (u) =>
        ROLES_PROSPECTAN.includes(u.rol) || ROLES_PROSPECTAN.includes(u.rol_secundario ?? "")
    )
    .map((u) => ({ id: u.id, nombre: u.nombre, email: u.email }));
  if (prospectan.length === 0) return { avisados: 0 };

  const resumen = resumirActividad(
    (contactosRaw ?? []) as ContactoActividad[],
    prospectan,
    hoy
  );

  const yaAvisado = async (uid: string) => {
    const { data } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", uid)
      .eq("tipo", "recordatorio")
      .eq("link", "/prospeccion/actividad")
      .gte("created_at", inicioHoyCordoba.toISOString())
      .limit(1);
    return !!data?.length;
  };

  let avisados = 0;
  for (const f of resumen.filas) {
    if (await yaAvisado(f.id)) continue;
    await admin.from("notifications").insert({
      user_id: f.id,
      tipo: "recordatorio",
      mensaje: avisoPersonal(f),
      link: "/prospeccion/actividad",
      task_id: null,
    });
    avisados++;
  }

  // Y el resumen del equipo, solo para los admin.
  const texto = avisoParaElDueno(resumen);
  for (const u of users.filter((x) => x.rol === "admin")) {
    if (resumen.filas.some((f) => f.id === u.id) && !resumen.nadieEscribioHoy) continue;
    const { data } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", u.id)
      .eq("tipo", "recordatorio")
      .eq("link", "/prospeccion")
      .gte("created_at", inicioHoyCordoba.toISOString())
      .limit(1);
    if (data?.length) continue;
    await admin.from("notifications").insert({
      user_id: u.id,
      tipo: "recordatorio",
      mensaje: texto,
      link: "/prospeccion",
      task_id: null,
    });
    avisados++;
  }

  return { avisados, totalHoy: resumen.totalHoy, meta: resumen.metaEquipoHoy };
}

/**
 * Recordatorio mensual de COBRO: arrancado el mes, avisa a admins + feature
 * finanzas que toca enviar los recordatorios de cobro a los clientes (la idea
 * es que paguen el 1° para tener margen de pagarle al equipo). No genera
 * facturas — solo lleva a /finanzas/recordatorios, donde cada mensaje de
 * WhatsApp sale a un toque. Dedup: un solo aviso por mes calendario.
 */
export async function ensureCobroReminders(admin: SupabaseClient) {
  const periodo = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM"); // YYYY-MM
  const inicioMesCordoba = toZonedTime(new Date(periodo + "-01T00:00:00"), TIMEZONE);

  // Cuántos clientes activos hay para cobrar (informativo en el mensaje).
  const { count } = await admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("estado", "activo")
    .eq("es_interno", false);
  const n = count ?? 0;
  if (n === 0) return;

  const { data: usersRaw } = await admin
    .from("users")
    .select("id, rol, permisos")
    .eq("activo", true);
  type URow = { id: string; rol: string; permisos: Record<string, boolean> | null };
  const recipients = ((usersRaw ?? []) as URow[])
    .filter((u) => u.rol === "admin" || u.permisos?.finanzas === true)
    .map((u) => u.id);
  if (recipients.length === 0) return;

  const mensaje = `💰 Nuevo mes: enviá los recordatorios de cobro a tus ${n} cliente${
    n > 1 ? "s" : ""
  } activo${n > 1 ? "s" : ""}. Ideal cobrar el 1° para poder pagarle al equipo.`;

  for (const uid of recipients) {
    // Dedup por mes: ¿ya le avisamos este mes con este link?
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", uid)
      .eq("tipo", "recordatorio")
      .eq("link", "/finanzas/recordatorios")
      .gte("created_at", inicioMesCordoba.toISOString())
      .limit(1);
    if (existing && existing.length > 0) continue;
    await admin.from("notifications").insert({
      user_id: uid,
      tipo: "recordatorio",
      mensaje,
      link: "/finanzas/recordatorios",
      task_id: null,
    });
  }
}

/**
 * Avisa por las piezas trabadas en "revisión creativa".
 *
 * El aviso de vencidas de arriba mira `tasks`, y una pieza en revisión creativa
 * no tiene tarea abierta: diseño ya cerró la suya. Por eso se caía del radar.
 * Acá se le avisa al CM de la cuenta y, si la pieza lleva más de
 * `DIAS_PARA_ESCALAR` esperando, también a coordinación y a los dueños.
 *
 * Dedup: un aviso por persona y por cuenta por día.
 */
export async function ensureRevisionCreativaNudges(admin: SupabaseClient) {
  const hoy = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const inicioHoyCordoba = toZonedTime(new Date(hoy + "T00:00:00"), TIMEZONE);

  const [{ data: pubsRaw, error: pubsErr }, { data: cuentasRaw }, { data: adminsRaw }] =
    await Promise.all([
      admin
        .from("publications")
        .select(
          "id, cliente_id, titulo, estado, fecha_publicacion, frenado_cliente, revision_creativa_at"
        )
        .eq("estado", "revision_creativa"),
      admin.from("clients").select("id, nombre, estado, cm_id, coordinador_id"),
      admin.from("users").select("id").eq("rol", "admin").eq("activo", true),
    ]);

  // La 0161 puede no estar aplicada: sin la marca se mide desde la fecha en que
  // la pieza debía salir, que para una trabada ya pasó. Peor que nada no es.
  let piezas = (pubsRaw ?? []) as PiezaEnRevision[];
  if (pubsErr) {
    if ((pubsErr as { code?: string }).code !== "42703") return { avisados: 0 };
    const { data } = await admin
      .from("publications")
      .select("id, cliente_id, titulo, estado, fecha_publicacion, frenado_cliente")
      .eq("estado", "revision_creativa");
    piezas = (data ?? []) as PiezaEnRevision[];
  }
  if (!piezas.length) return { avisados: 0 };

  const avisos = avisosDeRevisionCreativa(
    piezas,
    (cuentasRaw ?? []) as CuentaParaRevision[],
    ((adminsRaw ?? []) as { id: string }[]).map((u) => u.id),
    hoy
  );

  let avisados = 0;
  for (const a of avisos) {
    const { data: yaHay } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", a.userId)
      .eq("tipo", "recordatorio")
      .eq("link", a.link)
      .gte("created_at", inicioHoyCordoba.toISOString())
      .limit(1);
    if (yaHay?.length) continue;
    await admin.from("notifications").insert({
      user_id: a.userId,
      tipo: "recordatorio",
      mensaje: a.mensaje,
      link: a.link,
      task_id: null,
    });
    avisados++;
  }

  return { avisados, piezas: piezas.length };
}
