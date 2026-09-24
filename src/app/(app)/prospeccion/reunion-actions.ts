"use server";

import { revalidatePath } from "next/cache";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push";
import { cuandoReunion, linkGoogleCalendar, tituloReunion } from "@/lib/prospecting/reunion";
import { instagramUrl } from "@/lib/prospecting/shared";

const ROLES = ["admin", "coordinador", "comercial", "prospecting"];

export interface AgendarReunionInput {
  contactId: string;
  /** Inicio, ISO (el navegador ya lo pasó de hora local a UTC). */
  inicio: string;
  duracionMin: number;
  link?: string | null;
}

/**
 * Agenda la reunión con un prospecto (pedido del dueño, 24/9).
 *
 * Pasa el contacto a "reunión", crea o mueve la reunión en la Agenda y avisa
 * a quien contacta y al director, en la plataforma y en el celular. Devuelve
 * el link para sumarla a Google Calendar: la conexión de la app con Google es
 * de solo lectura, así que el evento lo guarda la persona con un toque.
 */
export async function agendarReunionProspecto(input: AgendarReunionInput) {
  const me = await requireUser();
  if (!userInRoles(me, ROLES)) return { error: "No tenés permiso." };

  const inicio = new Date(input.inicio);
  if (Number.isNaN(inicio.getTime())) return { error: "Falta el día y la hora." };
  const dur = Math.min(240, Math.max(15, Math.round(input.duracionMin || 45)));
  const fin = new Date(inicio.getTime() + dur * 60_000);

  const admin = createAdmin();
  const { data: c } = await admin
    .from("prospecting_contacts")
    .select(
      "id, campaign_id, empresa, contacto_nombre, telefono, instagram, asignado_a, contactado_at, reunion_at, reunion_meeting_id"
    )
    .eq("id", input.contactId)
    .maybeSingle();
  if (!c) return { error: "No existe ese contacto." };
  const ct = c as {
    id: string;
    campaign_id: string;
    empresa: string;
    contacto_nombre: string | null;
    telefono: string | null;
    instagram: string | null;
    asignado_a: string | null;
    contactado_at: string | null;
    reunion_at: string | null;
    reunion_meeting_id: string | null;
  };

  // Quién va: el que lleva el contacto (o quien la agenda) y la dirección
  // (área Estrategia/Dirección: Joaquín). Coordinación General no: es de admin
  // pero no está en las reuniones comerciales.
  const quienContacta = ct.asignado_a ?? me.id;
  const { data: dir } = await admin
    .from("users")
    .select("id")
    .eq("rol", "admin")
    .eq("area", "Estrategia/Dirección")
    .eq("activo", true);
  const asistentes = [...new Set([quienContacta, ...((dir ?? []) as { id: string }[]).map((u) => u.id)])];

  const titulo = tituloReunion(ct.empresa);
  const ig = instagramUrl(ct.instagram);
  const detalle = [
    ct.contacto_nombre ? `Contacto: ${ct.contacto_nombre}` : null,
    ct.telefono ? `Teléfono: ${ct.telefono}` : null,
    ig ? `Instagram: ${ig}` : null,
    `Ficha: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://jd-media-app.vercel.app"}/prospeccion/${ct.campaign_id}/contactos`,
  ]
    .filter(Boolean)
    .join("\n");
  const link = input.link?.trim() || null;

  // Crear o mover la reunión de la Agenda (reprogramar no duplica).
  let meetingId = ct.reunion_meeting_id;
  const datos = {
    titulo,
    descripcion: detalle,
    starts_at: inicio.toISOString(),
    ends_at: fin.toISOString(),
    meet_link: link,
  };
  if (meetingId) {
    const { error } = await admin.from("internal_meetings").update(datos).eq("id", meetingId);
    if (error) meetingId = null;
  }
  const reprogramada = !!meetingId;
  if (!meetingId) {
    const { data: m, error } = await admin
      .from("internal_meetings")
      .insert({ ...datos, created_by: me.id })
      .select("id")
      .single();
    if (error || !m) return { error: error?.message ?? "No se pudo crear la reunión." };
    meetingId = (m as { id: string }).id;
  }
  await admin.from("internal_meeting_attendees").delete().eq("meeting_id", meetingId);
  await admin
    .from("internal_meeting_attendees")
    .insert(asistentes.map((user_id) => ({ meeting_id: meetingId, user_id })));

  // El contacto: a reunión, con su día y hora.
  const ahora = new Date().toISOString();
  const { error: eUpd } = await admin
    .from("prospecting_contacts")
    .update({
      estado: "reunion",
      contactable: true,
      reunion_fecha: inicio.toISOString(),
      reunion_meeting_id: meetingId,
      // Los sellos del embudo no se pisan: cuentan cuándo pasó cada cosa.
      reunion_at: ct.reunion_at ?? ahora,
      contactado_at: ct.contactado_at ?? ahora,
      asignado_a: ct.asignado_a ?? me.id,
    })
    .eq("id", ct.id);
  if (eUpd) return { error: eUpd.message };

  // Aviso a los dos, también a quien la agenda: le sirve de recordatorio en el celu.
  const cuando = cuandoReunion(inicio.toISOString());
  const mensaje = `${reprogramada ? "Reunión reprogramada" : "Reunión agendada"} con ${ct.empresa}: ${cuando}.`;
  await admin.from("notifications").insert(
    asistentes.map((user_id) => ({
      user_id,
      task_id: null,
      tipo: "recordatorio",
      mensaje,
      link: "/agenda",
    }))
  );
  await sendPushToUsers(asistentes, {
    title: reprogramada ? "Reunión reprogramada" : "Nueva reunión comercial",
    body: mensaje,
    url: "/agenda",
    tag: `reunion-prospecto-${ct.id}`,
  });

  revalidatePath(`/prospeccion/${ct.campaign_id}/contactos`);
  revalidatePath("/captacion");
  revalidatePath("/agenda");
  return {
    ok: true as const,
    cuando,
    googleCalendar: linkGoogleCalendar({
      titulo,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      detalle,
      ubicacion: link,
    }),
  };
}
