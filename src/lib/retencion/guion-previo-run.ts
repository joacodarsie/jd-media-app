/**
 * El guion de la reunión mensual, listo antes de la reunión (19/10/2026).
 * Cada mañana el cron busca las reuniones mensuales de los próximos 3 días
 * (las que agenda el cliente desde el portal o el equipo), arma el guion con
 * IA si todavía no está, y se lo deja en la tarea a quien la da. Le saca la
 * excusa de «no tuve tiempo de prepararla».
 */
import { createAdmin } from "@/lib/supabase/admin";
import { loadMeetingContext } from "@/lib/monthly-diagnostics/context";
import { generateMeetingGuion } from "@/lib/monthly-diagnostics/guion";
import { periodoDeReunion } from "@/lib/monthly-diagnostics/schema";
import { etiquetaTurno } from "./reunion-autoagenda";

type Admin = ReturnType<typeof createAdmin>;

/** Tope por corrida: cada guion es una llamada a la IA. */
const MAX_POR_DIA = 4;
export const MARCA_GUION = "📋 **El guion de la reunión ya está listo**";

const enCordoba = (iso: string) => {
  const d = new Date(Date.parse(iso) - 3 * 3_600_000);
  return { dia: d.toISOString().slice(0, 10), hora: d.getUTCHours() };
};

export async function runGuionesPrevios(admin: Admin): Promise<{ generados: string[]; ya: number }> {
  const ahora = new Date();
  const en3 = new Date(ahora.getTime() + 3 * 86_400_000);
  const { data: mRaw } = await admin
    .from("internal_meetings")
    .select("client_id, starts_at, created_by, cliente:clients(nombre)")
    .like("titulo", "Reunión mensual%")
    .not("client_id", "is", null)
    .gte("starts_at", ahora.toISOString())
    .lte("starts_at", en3.toISOString())
    .order("starts_at");
  const reuniones = (mRaw ?? []) as unknown as {
    client_id: string;
    starts_at: string;
    created_by: string | null;
    cliente: { nombre: string } | null;
  }[];
  const r = { generados: [] as string[], ya: 0 };

  for (const m of reuniones) {
    if (r.generados.length >= MAX_POR_DIA) break;
    const cuando = enCordoba(m.starts_at);
    const periodo = periodoDeReunion(cuando.dia);
    const { data: rep } = await admin
      .from("client_monthly_reports")
      .select("ai_meet_guion")
      .eq("cliente_id", m.client_id)
      .eq("year_month", periodo)
      .maybeSingle();
    if ((rep as { ai_meet_guion?: string | null } | null)?.ai_meet_guion) {
      r.ya++;
    } else {
      const texto = await generateMeetingGuion(await loadMeetingContext(m.client_id, periodo)).catch(() => null);
      if (!texto) continue;
      await admin.from("client_monthly_reports").upsert(
        {
          cliente_id: m.client_id,
          year_month: periodo,
          ai_meet_guion: texto,
          ai_meet_guion_at: new Date().toISOString(),
          created_by_id: m.created_by,
        },
        { onConflict: "cliente_id,year_month" }
      );
      r.generados.push(m.cliente?.nombre ?? m.client_id);
    }

    // En la tarea de la reunión, una sola vez: dónde está el guion.
    const { data: tRaw } = await admin
      .from("tasks")
      .select("id, descripcion, asignado_a_id")
      .eq("cliente_id", m.client_id)
      .like("titulo", "Reunión mensual — %")
      .not("estado", "in", "(completada,archivada)")
      .limit(1);
    const t = ((tRaw ?? []) as { id: string; descripcion: string | null; asignado_a_id: string | null }[])[0];
    if (!t || (t.descripcion ?? "").includes(MARCA_GUION)) continue;
    const extra = `${MARCA_GUION} para el ${etiquetaTurno(cuando)}: está en la ficha del cliente → Reunión (/clientes/${m.client_id}/reunion). Leelo 5 minutos antes de entrar.`;
    await admin
      .from("tasks")
      .update({ descripcion: [t.descripcion, extra].filter(Boolean).join("\n\n") })
      .eq("id", t.id);
    if (t.asignado_a_id) {
      await admin.from("notifications").insert({
        user_id: t.asignado_a_id,
        task_id: t.id,
        tipo: "recordatorio",
        mensaje: `📋 Tenés listo el guion de la reunión con ${m.cliente?.nombre ?? "el cliente"} (${etiquetaTurno(cuando)}).`,
        link: `/clientes/${m.client_id}/reunion`,
      });
    }
  }
  return r;
}
