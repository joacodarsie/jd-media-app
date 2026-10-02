"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser, isStaffUser } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
import { cuandoReunion } from "@/lib/prospecting/reunion";
import { diaArgentina, horasDeJornada, moverADia } from "@/lib/agenda/eventos";
import { precioJornada } from "@/lib/jornada";

export interface MeetingInput {
  titulo: string;
  descripcion?: string | null;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  ubicacion?: string | null;
  meet_link?: string | null;
  client_id?: string | null;
  attendee_ids: string[];
  /** "jornada" = jornada de producción: se registra sola para Sueldos. */
  tipo?: "reunion" | "jornada";
}

function validate(input: MeetingInput): string | null {
  if (!input.titulo?.trim()) return "El título es obligatorio";
  if (!input.starts_at || !input.ends_at) return "Faltan fecha/hora";
  if (new Date(input.ends_at) <= new Date(input.starts_at))
    return "El fin tiene que ser posterior al inicio";
  if (input.tipo === "jornada") {
    if (!input.client_id) return "Elegí de qué cliente es la jornada.";
    if (!input.attendee_ids.length) return "Elegí quiénes van a la jornada.";
  }
  return null;
}

/**
 * El registro de la jornada para Sueldos (production_sessions), armado desde
 * el evento de la agenda. Si ya existe se actualiza (fecha, horas, cliente,
 * quiénes van); los viáticos y las notas se cargan después y no se pisan.
 */
async function guardarJornada(
  meetingId: string,
  input: MeetingInput,
  sesionId: string | null,
  actorId: string
): Promise<string | null> {
  const admin = createAdmin();
  const fecha = diaArgentina(input.starts_at);
  const horas = horasDeJornada(input.starts_at, input.ends_at);
  const base = {
    fecha,
    periodo: fecha.slice(0, 7),
    horas,
    monto: precioJornada(horas),
    cliente_id: input.client_id || null,
    lugar: input.ubicacion?.trim() || null,
    asistentes: input.attendee_ids,
  };
  if (sesionId) {
    const { error } = await admin.from("production_sessions").update(base).eq("id", sesionId);
    return error ? error.message : null;
  }
  const { data, error } = await admin
    .from("production_sessions")
    .insert({ ...base, notas: "Agendada en la Agenda", creado_por_id: actorId })
    .select("id")
    .single();
  if (error || !data) return error?.message ?? "No se pudo registrar la jornada";
  await admin.from("internal_meetings").update({ production_session_id: data.id }).eq("id", meetingId);
  return null;
}

function revalidarJornadas() {
  revalidatePath("/coordinacion/jornadas");
  revalidatePath("/coordinacion/sueldos");
}

async function notifyAttendees(
  meetingId: string,
  meetingTitle: string,
  startsAt: string,
  attendeeIds: string[],
  actorId: string,
  actorName: string,
  action: "created" | "updated",
  esJornada = false
) {
  const admin = createAdmin();
  // En hora de Argentina: el server de Vercel corre en UTC y sin fijar la zona
  // una reunión de las 15 se avisaba "a las 18".
  const when = cuandoReunion(startsAt);

  // Notificar a asistentes (menos el actor) + a admins (menos el actor) que no esten ya en asistentes.
  const recipients = new Set<string>(attendeeIds.filter((id) => id !== actorId));

  const { data: admins } = await admin
    .from("users")
    .select("id")
    .in("rol", ["admin", "coordinador"])
    .eq("activo", true);
  for (const a of admins ?? []) {
    if (a.id !== actorId) recipients.add(a.id as string);
  }

  if (recipients.size === 0) return;

  const verb = action === "created" ? "agendó" : "actualizó";
  const mensaje = `${actorName} ${verb} ${esJornada ? "una jornada de producción" : "una reunión"}: "${meetingTitle}" — ${when}`;

  const recipientIds = [...recipients];
  const rows = recipientIds.map((uid) => ({
    user_id: uid,
    task_id: null,
    tipo: "recordatorio" as const,
    mensaje,
    link: "/agenda",
  }));

  await admin.from("notifications").insert(rows);

  // Push notification al celu / desktop (silencioso si no hay VAPID o subs)
  await sendPushToUsers(recipientIds, {
    title: action === "created" ? "Nueva reunión" : "Reunión actualizada",
    body: mensaje,
    url: "/agenda",
    tag: `meeting-${meetingId}`,
  });
}

export async function createInternalMeeting(input: MeetingInput) {
  const err = validate(input);
  if (err) return { error: err };
  const me = await requireUser();
  const supabase = createClient();

  const { data: meeting, error } = await supabase
    .from("internal_meetings")
    .insert({
      titulo: input.titulo.trim(),
      descripcion: input.descripcion?.trim() || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      ubicacion: input.ubicacion?.trim() || null,
      meet_link: input.meet_link?.trim() || null,
      client_id: input.client_id || null,
      created_by: me.id,
      tipo: input.tipo === "jornada" ? "jornada" : "reunion",
    })
    .select("id")
    .single();

  if (error || !meeting) return { error: error?.message ?? "Error al crear" };

  // Aseguramos que el creador esté como asistente (a menos que ya esté). En una
  // jornada no: los asistentes son los que van y cobran, no quien la agenda.
  const esJornada = input.tipo === "jornada";
  const attendees = new Set<string>(input.attendee_ids);
  if (!esJornada) attendees.add(me.id);

  if (esJornada) {
    const errJ = await guardarJornada(meeting.id, input, null, me.id);
    if (errJ) return { error: "La jornada se agendó pero no se pudo registrar para Sueldos: " + errJ };
    revalidarJornadas();
  }

  if (attendees.size > 0) {
    const rows = [...attendees].map((uid) => ({
      meeting_id: meeting.id,
      user_id: uid,
    }));
    await supabase.from("internal_meeting_attendees").insert(rows);
  }

  await notifyAttendees(
    meeting.id,
    input.titulo,
    input.starts_at,
    [...attendees],
    me.id,
    me.nombre,
    "created",
    esJornada
  );

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true, id: meeting.id };
}

export async function updateInternalMeeting(id: string, input: MeetingInput) {
  const err = validate(input);
  if (err) return { error: err };
  const me = await requireUser();
  const supabase = createClient();

  const esJornada = input.tipo === "jornada";
  const { data: previa } = await supabase
    .from("internal_meetings")
    .select("production_session_id")
    .eq("id", id)
    .maybeSingle();
  const sesionPrevia = (previa as { production_session_id?: string | null } | null)?.production_session_id ?? null;

  const { error } = await supabase
    .from("internal_meetings")
    .update({
      tipo: esJornada ? "jornada" : "reunion",
      titulo: input.titulo.trim(),
      descripcion: input.descripcion?.trim() || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      ubicacion: input.ubicacion?.trim() || null,
      meet_link: input.meet_link?.trim() || null,
      client_id: input.client_id || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  if (esJornada) {
    const errJ = await guardarJornada(id, input, sesionPrevia, me.id);
    if (errJ) return { error: "No se pudo actualizar la jornada en Sueldos: " + errJ };
    revalidarJornadas();
  } else if (sesionPrevia) {
    // Dejó de ser jornada: se saca de Sueldos.
    await createAdmin().from("production_sessions").delete().eq("id", sesionPrevia);
    revalidarJornadas();
  }

  // Reemplazar asistentes
  const attendees = new Set<string>(input.attendee_ids);
  if (!esJornada) attendees.add(me.id);

  await supabase.from("internal_meeting_attendees").delete().eq("meeting_id", id);
  const rows = [...attendees].map((uid) => ({
    meeting_id: id,
    user_id: uid,
  }));
  if (rows.length) await supabase.from("internal_meeting_attendees").insert(rows);

  await notifyAttendees(
    id,
    input.titulo,
    input.starts_at,
    [...attendees],
    me.id,
    me.nombre,
    "updated",
    esJornada
  );

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteInternalMeeting(id: string) {
  await requireUser();
  const supabase = createClient();
  // `.select()` para saber si de verdad se borró: cuando la RLS no deja, el
  // delete devuelve 0 filas SIN error y antes eso se mostraba como "eliminada"
  // mientras la reunión seguía ahí.
  const { data, error } = await supabase
    .from("internal_meetings")
    .delete()
    .eq("id", id)
    .select("id, production_session_id");
  if (error) return { error: error.message };
  if (!data?.length)
    return {
      error:
        "No se pudo eliminar: solo quien la agendó o la coordinación pueden borrar una reunión.",
    };
  // Si era una jornada, también sale de Sueldos.
  const sesion = (data[0] as { production_session_id?: string | null }).production_session_id;
  if (sesion) {
    await createAdmin().from("production_sessions").delete().eq("id", sesion);
    revalidarJornadas();
  }
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Arrastrar en la agenda: mueve una reunión o jornada a otro día, con la misma
 * hora y duración. Si es una jornada, Sueldos se entera.
 */
export async function moverEventoAgenda(meetingId: string, nuevoDia: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nuevoDia)) return { error: "Día inválido" };
  await requireUser();
  const supabase = createClient();
  const { data: m } = await supabase
    .from("internal_meetings")
    .select("starts_at, ends_at, production_session_id")
    .eq("id", meetingId)
    .maybeSingle();
  if (!m) return { error: "No se encontró la reunión" };
  const nuevo = moverADia(m as { starts_at: string; ends_at: string }, nuevoDia);
  if (!nuevo) return { ok: true };
  const { data, error } = await supabase
    .from("internal_meetings")
    .update(nuevo)
    .eq("id", meetingId)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Solo quien la agendó o la coordinación pueden moverla." };
  const sesion = (m as { production_session_id?: string | null }).production_session_id;
  if (sesion) {
    await createAdmin()
      .from("production_sessions")
      .update({ fecha: nuevoDia, periodo: nuevoDia.slice(0, 7) })
      .eq("id", sesion);
    revalidarJornadas();
  }
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Mueve de día una jornada cargada a mano en /coordinacion/jornadas. */
export async function moverJornadaSuelta(sesionId: string, nuevoDia: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nuevoDia)) return { error: "Día inválido" };
  const me = await requireUser();
  if (!isStaffUser(me)) return { error: "Solo la coordinación puede mover una jornada." };
  const { error } = await createAdmin()
    .from("production_sessions")
    .update({ fecha: nuevoDia, periodo: nuevoDia.slice(0, 7) })
    .eq("id", sesionId);
  if (error) return { error: error.message };
  revalidarJornadas();
  revalidatePath("/agenda");
  return { ok: true };
}
