/**
 * El ejecutor de la reunión mensual: junta la data, crea los tickets que faltan
 * y escala al dueño lo que sigue sin darse. La decisión de QUÉ falta vive en
 * `reunion-mensual.ts` (puro y testeado); acá solo se habla con la base.
 *
 * Idempotente: deduplica por el título del ticket, así que el cron diario lo
 * puede correr todos los días sin crear nada dos veces.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import {
  reunionesFaltantes,
  reunionesAtrasadas,
  avisoAtrasadas,
  periodoDe,
  type ClienteParaReunion,
  type ReunionRegistrada,
} from "./reunion-mensual";

type Admin = SupabaseClient;

export async function runReunionesMensuales(
  admin: Admin,
  hoyYmd?: string
): Promise<{ creadas: number; atrasadas: number; avisados: number; periodo: string }> {
  const hoy = hoyYmd ?? formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const periodo = periodoDe(hoy);

  const [clientesRes, meetingsRes, tasksRes, usersRes] = await Promise.all([
    admin
      .from("clients")
      .select("id, nombre, estado, es_interno, cm_id, responsable_id")
      .eq("estado", "activo"),
    admin.from("client_meetings").select("cliente_id, periodo").eq("periodo", periodo),
    // Solo los títulos del período: alcanza para deduplicar y no trae la tabla
    // entera. Las archivadas también cuentan — si alguien archivó el ticket, no
    // hay que volver a crearlo el día siguiente.
    admin.from("tasks").select("titulo, cliente_id").like("titulo", `Reunión mensual — %— ${periodo}`),
    admin.from("users").select("id, nombre, email, rol").eq("activo", true),
  ]);

  const clientes = (clientesRes.data ?? []) as ClienteParaReunion[];
  const registradas = (meetingsRes.data ?? []) as ReunionRegistrada[];
  const tickets = (tasksRes.data ?? []) as { titulo: string; cliente_id: string | null }[];
  const titulos = tickets.map((t) => t.titulo);
  const clientesConTicket = tickets.map((t) => t.cliente_id).filter(Boolean) as string[];
  const users = (usersRes.data ?? []) as {
    id: string;
    nombre: string;
    email: string | null;
    rol: string;
  }[];

  // Quien da la reunión cuando la cuenta no tiene CM: la project manager
  // (decisión de la reunión del 13/9). Si no está, cae en el primer admin.
  const pm = users.find((u) => u.rol === "coordinador" && u.email === "luz@jdmedia.com");
  const responsable = (pm ?? users.find((u) => u.rol === "admin"))?.id;
  if (!responsable) return { creadas: 0, atrasadas: 0, avisados: 0, periodo };
  const nombrePorId = Object.fromEntries(users.map((u) => [u.id, u.nombre]));

  const faltan = reunionesFaltantes({
    clientes,
    registradas,
    titulosExistentes: titulos,
    clientesConTicket,
    responsable,
    nombrePorId,
    hoy,
  });

  let creadas = 0;
  if (faltan.length > 0) {
    const { data: nuevas, error } = await admin.from("tasks").insert(
      faltan.map((t) => ({
        titulo: t.titulo,
        descripcion: t.descripcion,
        cliente_id: t.cliente_id,
        asignado_a_id: t.asignado_a_id,
        creado_por_id: responsable,
        area: t.area,
        prioridad: t.prioridad,
        estado: "pendiente",
        fecha_limite: t.fecha_limite,
      }))
    ).select("id, cliente_id");
    if (!error) {
      creadas = faltan.length;
      // El director creativo participa: queda siguiendo el ticket.
      const participa = new Map(faltan.map((t) => [t.cliente_id, t.participa_id]));
      const watchers = ((nuevas ?? []) as { id: string; cliente_id: string }[])
        .map((n) => ({ task_id: n.id, user_id: participa.get(n.cliente_id) ?? null }))
        .filter((w): w is { task_id: string; user_id: string } => !!w.user_id);
      if (watchers.length > 0) await admin.from("task_watchers").insert(watchers);
    }
  }

  // ── Escalada al dueño, del 15 en adelante ──
  const atrasadas = reunionesAtrasadas({ clientes, registradas, hoy });
  let avisados = 0;
  if (atrasadas.length > 0) {
    const inicioHoy = toZonedTime(new Date(`${hoy}T00:00:00`), TIMEZONE).toISOString();
    const mensaje = avisoAtrasadas(atrasadas, periodo);
    for (const u of users.filter((x) => x.rol === "admin")) {
      const { data } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", u.id)
        .eq("tipo", "recordatorio")
        .eq("link", "/clientes")
        .gte("created_at", inicioHoy)
        .limit(1);
      if (data?.length) continue;
      await admin.from("notifications").insert({
        user_id: u.id,
        tipo: "recordatorio",
        mensaje,
        link: "/clientes",
        task_id: null,
      });
      avisados++;
    }
  }

  return { creadas, atrasadas: atrasadas.length, avisados, periodo };
}
