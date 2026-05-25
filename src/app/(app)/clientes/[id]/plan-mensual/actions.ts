"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import type { MonthlyContentPlan, TemaDestacado } from "@/lib/content-plans/schema";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Aprueba un draft del plan. Archiva el plan active anterior (si hay).
 */
export async function approvePlan(planId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = createClient();
  const admin = createAdmin();

  const { data: plan } = await supabase
    .from("client_content_plans")
    .select("id, cliente_id, status")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan no encontrado." };
  if (plan.status !== "draft") return { ok: false, error: "Solo se aprueban drafts." };

  // Archivar el active actual si hay otro.
  await admin
    .from("client_content_plans")
    .update({ status: "archived" })
    .eq("cliente_id", plan.cliente_id)
    .eq("status", "active");

  const { error } = await admin
    .from("client_content_plans")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clientes/${plan.cliente_id}/plan-mensual`);
  return { ok: true };
}

/**
 * Aplica el plan al calendario: crea una publication (estado: idea) por cada
 * tema destacado. Mantiene from_plan_id como traza. Idempotente: si el plan
 * ya tiene applied_at, no vuelve a correr.
 */
const FORMATO_TO_TIPO: Record<string, string> = {
  reel: "reel",
  post: "post",
  carrusel: "carrusel",
  story: "historia",
  video_largo: "reel",
  live: "post",
  otro: "post",
};

const RED_TO_DB: Record<string, string> = {
  instagram: "instagram",
  facebook: "facebook",
  tiktok: "tiktok",
  youtube: "youtube",
  linkedin: "linkedin",
  x: "x",
};

export async function applyPlanToCalendar(
  planId: string
): Promise<ActionResult<{ created: number }>> {
  const user = await requireUser();
  const admin = createAdmin();

  const { data: plan, error: fetchErr } = await admin
    .from("client_content_plans")
    .select("id, cliente_id, status, content, applied_at, periodo_label")
    .eq("id", planId)
    .maybeSingle();
  if (fetchErr || !plan) return { ok: false, error: "Plan no encontrado." };
  if (plan.status !== "active") return { ok: false, error: "El plan tiene que estar aprobado (active)." };
  if (plan.applied_at) return { ok: false, error: "El plan ya fue aplicado al calendario." };

  const content = plan.content as unknown as MonthlyContentPlan;
  const temas: TemaDestacado[] = Array.isArray(content?.temas_destacados)
    ? content.temas_destacados
    : [];
  if (temas.length === 0) return { ok: false, error: "El plan no tiene temas destacados." };

  // Si los temas no traen fecha, distribuir homogéneamente en el periodo.
  // Heurística: agarro la fecha del primer tema con fecha, o el inicio del próximo mes.
  const today = new Date();
  const baseDate = (() => {
    for (const t of temas) {
      if (t.fecha) {
        const d = new Date(t.fecha);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return today;
  })();

  const rows = temas.map((t, idx) => {
    let fecha: Date | null = null;
    if (t.fecha) {
      const d = new Date(t.fecha);
      if (!isNaN(d.getTime())) fecha = d;
    }
    if (!fecha) {
      // Espaciar cada 2-3 días desde la base
      fecha = new Date(baseDate);
      fecha.setDate(fecha.getDate() + idx * 3);
    }

    const red = t.red_principal ? RED_TO_DB[t.red_principal] ?? "instagram" : "instagram";
    const tipo = t.formato ? FORMATO_TO_TIPO[t.formato] ?? "post" : "post";

    return {
      cliente_id: plan.cliente_id,
      titulo: t.titulo,
      copy: null as string | null,
      guion: null as string | null,
      red,
      tipo,
      fecha_publicacion: fecha.toISOString(),
      estado: "idea",
      creado_por_id: user.id,
      from_plan_id: plan.id,
      notas_revision: `Generado desde Plan de Contenido "${plan.periodo_label}". ${t.descripcion}${t.pilar ? ` (Pilar: ${t.pilar})` : ""}${t.redes_replica && t.redes_replica.length > 0 ? ` Replicar en: ${t.redes_replica.join(", ")}.` : ""}`,
    };
  });

  const { data: inserted, error: insertErr } = await admin
    .from("publications")
    .insert(rows)
    .select("id");
  if (insertErr) return { ok: false, error: insertErr.message };

  await admin
    .from("client_content_plans")
    .update({
      applied_at: new Date().toISOString(),
      applied_count: inserted?.length ?? rows.length,
    })
    .eq("id", planId);

  revalidatePath(`/clientes/${plan.cliente_id}/plan-mensual`);
  revalidatePath(`/contenidos`);
  return { ok: true, data: { created: inserted?.length ?? rows.length } };
}

/**
 * Archiva un plan (sin aprobar otro). Útil para descartar drafts viejos.
 */
export async function archivePlan(planId: string): Promise<ActionResult> {
  await requireUser();
  const admin = createAdmin();
  const { data: plan } = await admin
    .from("client_content_plans")
    .select("cliente_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan no encontrado." };

  const { error } = await admin
    .from("client_content_plans")
    .update({ status: "archived" })
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clientes/${plan.cliente_id}/plan-mensual`);
  return { ok: true };
}
