"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";

export interface MeetingInput {
  titulo: string;
  descripcion?: string | null;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  ubicacion?: string | null;
  meet_link?: string | null;
  client_id?: string | null;
  attendee_ids: string[];
}

function validate(input: MeetingInput): string | null {
  if (!input.titulo?.trim()) return "El título es obligatorio";
  if (!input.starts_at || !input.ends_at) return "Faltan fecha/hora";
  if (new Date(input.ends_at) <= new Date(input.starts_at))
    return "El fin tiene que ser posterior al inicio";
  return null;
}

async function notifyAttendees(
  meetingId: string,
  meetingTitle: string,
  startsAt: string,
  attendeeIds: string[],
  actorId: string,
  actorName: string,
  action: "created" | "updated"
) {
  const admin = createAdmin();
  const when = new Date(startsAt).toLocaleString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

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
  const mensaje = `${actorName} ${verb} una reunión: "${meetingTitle}" — ${when}`;

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
    })
    .select("id")
    .single();

  if (error || !meeting) return { error: error?.message ?? "Error al crear" };

  // Aseguramos que el creador esté como asistente (a menos que ya esté).
  const attendees = new Set<string>(input.attendee_ids);
  attendees.add(me.id);

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
    "created"
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

  const { error } = await supabase
    .from("internal_meetings")
    .update({
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

  // Reemplazar asistentes
  const attendees = new Set<string>(input.attendee_ids);
  attendees.add(me.id);

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
    "updated"
  );

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteInternalMeeting(id: string) {
  await requireUser();
  const supabase = createClient();
  const { error } = await supabase.from("internal_meetings").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true };
}
