"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser, isStaffUser, requireRole } from "@/lib/auth";
import { runDirectorWeekly } from "@/lib/director/run";
import { runMonthStartReports } from "@/lib/director/monthly";
import type { DirectorIdea } from "@/lib/director/insight";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { friendlyAiError } from "@/lib/ai/errors";
import { computeAccountHealth } from "@/lib/director/health";
import { periodLabel } from "@/lib/finanzas";

const aiClient = new Anthropic();

const HEALTH_SYSTEM = `Sos el Director de JD Media (agencia de Córdoba, Argentina: gestión de redes, paid media, diseño y web para PyMEs).

Preparás un parte de seguimiento para la reunión quincenal de coordinación (Joaquín con Luz y Brisa). Te paso el estado de salud de CADA cuenta activa, con datos reales: cumplimiento del plan de contenido (piezas publicadas vs la cuota del pack), crecimiento de seguidores en Instagram, y tareas vencidas. Cada cuenta trae un semáforo (bien / regular / mal) y señales concretas.

Escribí un informe claro y accionable en MARKDOWN, para compartir pantalla en la reunión:
1. Un párrafo de arranque: cómo venimos a nivel general (cuántas bien/regular/mal).
2. **Cuentas para atender YA** (las "mal" y las "regular" más flojas): por cada una, en una o dos líneas, qué pasa y la acción concreta para prevenir o solucionar.
3. **Cuentas que van bien**: mencionalas brevemente; si ves una oportunidad de crecimiento o upsell, decila.
4. Cierre con 1-3 focos para las próximas 2 semanas.

NO inventes datos, usá solo lo que te paso. Conciso y concreto, tono profesional y directo, criollo argentino. Sin emojis raros.`;

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

/** Dispara el parte semanal del Director ahora (solo staff). Sin notificaciones. */
export async function runWeeklyNow() {
  const me = await requireUser();
  if (!isStaffUser(me)) return { error: "Solo admin/coordinación puede generarlo." };
  const admin = createAdmin();
  const res = await runDirectorWeekly(admin, new Date(), false);
  revalidatePath("/director");
  if (!res.ok) return { error: (res as { error?: string }).error ?? "Error generando" };
  return { ok: true, analyzed: (res as { analyzed?: number }).analyzed ?? 0 };
}

/** Genera/prepara los reportes mensuales del mes anterior ahora (solo staff). */
export async function runMonthlyNow() {
  const me = await requireUser();
  if (!isStaffUser(me)) return { error: "Solo admin/coordinación puede generarlo." };
  const admin = createAdmin();
  try {
    const res = await runMonthStartReports(admin, new Date());
    revalidatePath("/director");
    return { ok: true, prepared: (res as { prepared?: number }).prepared ?? 0 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error generando reportes" };
  }
}

/**
 * Crea una publicación en estado 'idea' a partir de una idea del Director,
 * y marca la idea como aplicada en el reporte.
 */
export async function applyDirectorIdea(reportId: string, ideaIndex: number) {
  const { supabase, userId } = await ctx();

  const { data: rep, error: repErr } = await supabase
    .from("director_reports")
    .select("cliente_id, ideas")
    .eq("id", reportId)
    .maybeSingle();
  if (repErr) return { error: repErr.message };
  if (!rep) return { error: "Reporte no encontrado." };

  const ideas = (Array.isArray(rep.ideas) ? rep.ideas : []) as DirectorIdea[];
  const idea = ideas[ideaIndex];
  if (!idea) return { error: "Idea no encontrada." };
  if (idea.applied_pub_id) return { error: "Esta idea ya fue agregada al calendario." };

  const { data: pub, error } = await supabase
    .from("publications")
    .insert({
      cliente_id: rep.cliente_id,
      titulo: idea.titulo,
      copy: idea.copy ?? null,
      red: idea.red || "instagram",
      tipo: idea.tipo || "post",
      estado: "idea",
      creado_por_id: userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  ideas[ideaIndex] = { ...idea, applied_pub_id: pub.id };
  await supabase.from("director_reports").update({ ideas }).eq("id", reportId);

  revalidatePath("/director");
  revalidatePath("/contenidos");
  return { ok: true, pubId: pub.id as string };
}

/**
 * Resumen del Director con IA sobre la SALUD de las cuentas (del 1° a hoy).
 * Texto listo para la reunión quincenal. Efímero (no se guarda). Degrada con un
 * mensaje amable si la IA no está disponible.
 */
export async function generateDirectorSummary() {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();
  const { periodo, cuentas, resumen } = await computeAccountHealth(admin);
  if (cuentas.length === 0) return { ok: true, texto: "No hay cuentas activas para analizar." };

  const lineas = cuentas.map((c) => {
    const partes = [
      `semáforo ${c.semaforo}`,
      c.planMeta > 0 ? `plan ${c.planHechas}/${c.planMeta}` : "sin cuota fija",
      c.igConectado && c.igDelta != null
        ? `IG ${c.igDelta >= 0 ? "+" : ""}${c.igDelta} seguidores`
        : "IG sin datos",
      `${c.tareasVencidas} tareas vencidas`,
    ];
    const señales = [...c.alertas, ...c.buenas];
    return `- ${c.nombre} (${c.pack ?? "s/pack"}): ${partes.join(" · ")}${señales.length ? ` — ${señales.join("; ")}` : ""}`;
  });

  const userMsg = `Período: ${periodLabel(periodo)} (del 1° a hoy).
Resumen: ${resumen.bien} bien, ${resumen.regular} regular, ${resumen.mal} mal (de ${resumen.total} cuentas).

Estado por cuenta (peor primero):
${lineas.join("\n")}

Armá el parte de seguimiento para la reunión.`;

  try {
    const res = await aiClient.messages.create({
      model: AI_MODEL_SMART,
      max_tokens: 2000,
      system: HEALTH_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });
    const texto = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { ok: true, texto };
  } catch (e) {
    console.error("generateDirectorSummary error:", e);
    return { error: friendlyAiError(e) };
  }
}
