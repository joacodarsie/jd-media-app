/**
 * Lo que habla con la base para que el cliente agende su reunión mensual desde
 * el portal (ver reunion-autoagenda.ts). Aparece mientras su ticket «Reunión
 * mensual — X — mes» siga abierto y la reunión no se haya dado ni agendado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AREA_PM } from "@/lib/tareas/puerta";
import { sendPushToUsers } from "@/lib/push";
import { esTurnoValido, etiquetaTurno, turnosLibres, type Turno } from "./reunion-autoagenda";

export type ReunionPortal =
  | { estado: "agendada"; etiqueta: string }
  | { estado: "elegir"; turnos: Turno[]; conQuien: string | null };

const PREFIJO = "Reunión mensual";

async function contexto(admin: SupabaseClient, clienteId: string, hoy: string) {
  const periodo = hoy.slice(0, 7);
  const { data: c } = await admin.from("clients").select("id, nombre").eq("id", clienteId).maybeSingle();
  const cli = c as { id: string; nombre: string } | null;
  if (!cli) return null;
  const [{ data: tRaw }, { data: hecha }, { data: futuras }] = await Promise.all([
    admin
      .from("tasks")
      .select("id, asignado_a_id, estado")
      .eq("cliente_id", clienteId)
      .like("titulo", `${PREFIJO} — %— ${periodo}`)
      .not("estado", "in", "(completada,archivada)")
      .limit(1),
    admin.from("client_meetings").select("id").eq("cliente_id", clienteId).eq("periodo", periodo).limit(1),
    admin
      .from("internal_meetings")
      .select("starts_at")
      .eq("client_id", clienteId)
      .like("titulo", `${PREFIJO}%`)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(1),
  ]);
  const tarea = ((tRaw ?? []) as { id: string; asignado_a_id: string | null }[])[0];
  if (!tarea || (hecha ?? []).length) return null;
  return { cli, tarea, periodo, agendada: ((futuras ?? []) as { starts_at: string }[])[0] ?? null };
}

/** Los turnos libres de quien da la reunión (las reuniones a las que va y las que creó). */
async function libresDe(admin: SupabaseClient, userId: string | null, hoy: string): Promise<Turno[]> {
  if (!userId) return turnosLibres(hoy, []);
  const desde = new Date().toISOString();
  const hasta = new Date(Date.now() + 50 * 86_400_000).toISOString();
  const [{ data: asiste }, { data: creadas }] = await Promise.all([
    admin.from("internal_meeting_attendees").select("meeting:internal_meetings(starts_at, ends_at)").eq("user_id", userId),
    admin.from("internal_meetings").select("starts_at, ends_at").eq("created_by", userId).gte("starts_at", desde).lte("starts_at", hasta),
  ]);
  const ocupados = [
    ...((asiste ?? []) as unknown as { meeting: { starts_at: string; ends_at: string | null } | null }[]).map((a) => a.meeting),
    ...((creadas ?? []) as { starts_at: string; ends_at: string | null }[]),
  ]
    .filter((m): m is { starts_at: string; ends_at: string | null } => !!m && m.starts_at >= desde && m.starts_at <= hasta)
    .map((m) => ({ inicio: m.starts_at, fin: m.ends_at ?? new Date(Date.parse(m.starts_at) + 3_600_000).toISOString() }));
  return turnosLibres(hoy, ocupados);
}

const enCordoba = (iso: string) => {
  const d = new Date(Date.parse(iso) - 3 * 3_600_000);
  return { dia: d.toISOString().slice(0, 10), hora: d.getUTCHours() };
};

export async function cargarReunionPortal(admin: SupabaseClient, clienteId: string, hoy: string): Promise<ReunionPortal | null> {
  const ctx = await contexto(admin, clienteId, hoy).catch(() => null);
  if (!ctx) return null;
  if (ctx.agendada) return { estado: "agendada", etiqueta: etiquetaTurno(enCordoba(ctx.agendada.starts_at)) };
  const responsable = ctx.tarea.asignado_a_id;
  const { data: u } = responsable
    ? await admin.from("users").select("nombre").eq("id", responsable).maybeSingle()
    : { data: null };
  const turnos = await libresDe(admin, responsable, hoy);
  return { estado: "elegir", turnos, conQuien: ((u as { nombre?: string } | null)?.nombre ?? "").split(" ")[0] || null };
}

export async function agendarReunionPortal(
  admin: SupabaseClient,
  clienteId: string,
  hoy: string,
  inicio: string
): Promise<{ ok: true; etiqueta: string } | { error: string }> {
  const ctx = await contexto(admin, clienteId, hoy);
  if (!ctx) return { error: "Esta reunión ya no está para agendar." };
  if (ctx.agendada) return { ok: true, etiqueta: etiquetaTurno(enCordoba(ctx.agendada.starts_at)) };
  const responsable = ctx.tarea.asignado_a_id;
  const turno = esTurnoValido(inicio, await libresDe(admin, responsable, hoy));
  if (!turno) return { error: "Ese horario se acaba de ocupar. Elegí otro." };

  const { data: us } = await admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true);
  const lista = (us ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const pm = lista.find((x) => x.area === AREA_PM || x.area_secundaria === AREA_PM)?.id ?? null;
  const dueno = lista.find((x) => x.rol === "admin")?.id ?? null;
  const creador = responsable ?? pm ?? dueno;
  if (!creador) return { error: "No pudimos agendarla. Escribinos por WhatsApp." };

  const { data: m, error } = await admin
    .from("internal_meetings")
    .insert({
      titulo: `${PREFIJO} — ${ctx.cli.nombre}`,
      descripcion: `La eligió ${ctx.cli.nombre} desde su plataforma. Mandale el link de Meet y llevá el reporte del mes.`,
      starts_at: turno.inicio,
      ends_at: turno.fin,
      client_id: clienteId,
      created_by: creador,
      tipo: "reunion",
    })
    .select("id")
    .single();
  if (error || !m) return { error: "No pudimos agendarla. Probá de nuevo." };
  await admin.from("internal_meeting_attendees").insert({ meeting_id: (m as { id: string }).id, user_id: creador });
  await admin.from("tasks").update({ fecha_limite: turno.dia }).eq("id", ctx.tarea.id);

  const etiqueta = etiquetaTurno(turno);
  const avisar = [...new Set([creador, pm].filter((x): x is string => !!x))];
  const mensaje = `🗓️ ${ctx.cli.nombre} eligió su reunión mensual: ${etiqueta}. Mandale el link de Meet.`;
  await admin
    .from("notifications")
    .insert(avisar.map((user_id) => ({ user_id, task_id: ctx.tarea.id, tipo: "recordatorio", mensaje, link: "/agenda" })));
  await sendPushToUsers(avisar, {
    title: "🗓️ Reunión agendada por el cliente",
    body: mensaje,
    url: "/agenda",
    tag: `reunion-${clienteId}`,
  }).catch(() => undefined);
  return { ok: true, etiqueta };
}
