"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import type { MonthlyContentPlan, TemaDestacado } from "@/lib/content-plans/schema";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

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

/**
 * Aprueba el draft -> active. Archiva el active anterior.
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

/**
 * Helper: convierte un tema en una row para insertar en publications.
 */
function buildPubRow(args: {
  cliente_id: string;
  plan_id: string;
  tema: TemaDestacado;
  tema_idx: number;
  plan_label: string;
  base_date: Date;
  fallback_offset: number;
  user_id: string;
}) {
  let fecha: Date | null = null;
  if (args.tema.fecha) {
    const d = new Date(args.tema.fecha);
    if (!isNaN(d.getTime())) fecha = d;
  }
  if (!fecha) {
    fecha = new Date(args.base_date);
    fecha.setDate(fecha.getDate() + args.fallback_offset * 3);
  }

  const red = args.tema.red_principal
    ? RED_TO_DB[args.tema.red_principal] ?? "instagram"
    : "instagram";
  const tipo = args.tema.formato
    ? FORMATO_TO_TIPO[args.tema.formato] ?? "post"
    : "post";

  return {
    cliente_id: args.cliente_id,
    titulo: args.tema.titulo,
    copy: null as string | null,
    guion: null as string | null,
    red,
    tipo,
    fecha_publicacion: fecha.toISOString(),
    estado: "idea",
    creado_por_id: args.user_id,
    from_plan_id: args.plan_id,
    from_plan_tema_idx: args.tema_idx,
    notas_revision: `Generado desde Plan "${args.plan_label}". ${args.tema.descripcion}${args.tema.pilar ? ` (Pilar: ${args.tema.pilar})` : ""}${args.tema.redes_replica && args.tema.redes_replica.length > 0 ? ` Replicar en: ${args.tema.redes_replica.join(", ")}.` : ""}`,
  };
}

/**
 * Aplica UN tema puntual al calendario. Idempotente: si ya está aplicado, error.
 */
export async function applyTemaToCalendar(
  planId: string,
  temaIdx: number
): Promise<ActionResult<{ publicationId: string }>> {
  const user = await requireUser();
  const admin = createAdmin();

  const { data: plan } = await admin
    .from("client_content_plans")
    .select("id, cliente_id, status, content, periodo_label, applied_temas_indices")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan no encontrado." };
  if (plan.status !== "active") return { ok: false, error: "El plan tiene que estar aprobado." };

  const applied: number[] = Array.isArray(plan.applied_temas_indices)
    ? plan.applied_temas_indices
    : [];
  if (applied.includes(temaIdx)) {
    return { ok: false, error: "Este tema ya fue aplicado al calendario." };
  }

  const content = plan.content as unknown as MonthlyContentPlan;
  const temas = Array.isArray(content?.temas_destacados) ? content.temas_destacados : [];
  const tema = temas[temaIdx];
  if (!tema) return { ok: false, error: "Tema no encontrado." };

  const baseDate = (() => {
    for (const t of temas) {
      if (t.fecha) {
        const d = new Date(t.fecha);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return new Date();
  })();

  const row = buildPubRow({
    cliente_id: plan.cliente_id,
    plan_id: plan.id,
    tema,
    tema_idx: temaIdx,
    plan_label: plan.periodo_label,
    base_date: baseDate,
    fallback_offset: temaIdx,
    user_id: user.id,
  });

  const { data: inserted, error: insertErr } = await admin
    .from("publications")
    .insert(row)
    .select("id")
    .single();
  if (insertErr || !inserted) return { ok: false, error: insertErr?.message ?? "No se pudo crear" };

  await admin
    .from("client_content_plans")
    .update({ applied_temas_indices: [...applied, temaIdx] })
    .eq("id", planId);

  revalidatePath(`/clientes/${plan.cliente_id}/plan-mensual`);
  revalidatePath(`/contenidos`);
  return { ok: true, data: { publicationId: inserted.id } };
}

/**
 * Aplica TODOS los temas pendientes (no aplicados todavía).
 */
export async function applyAllTemasToCalendar(
  planId: string
): Promise<ActionResult<{ created: number }>> {
  const user = await requireUser();
  const admin = createAdmin();

  const { data: plan } = await admin
    .from("client_content_plans")
    .select("id, cliente_id, status, content, periodo_label, applied_temas_indices")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan no encontrado." };
  if (plan.status !== "active") return { ok: false, error: "El plan tiene que estar aprobado." };

  const content = plan.content as unknown as MonthlyContentPlan;
  const temas = Array.isArray(content?.temas_destacados) ? content.temas_destacados : [];
  if (temas.length === 0) return { ok: false, error: "No hay temas para aplicar." };

  const applied: number[] = Array.isArray(plan.applied_temas_indices)
    ? plan.applied_temas_indices
    : [];
  const pendingIdxs = temas
    .map((_, i) => i)
    .filter((i) => !applied.includes(i));
  if (pendingIdxs.length === 0) return { ok: false, error: "Todos los temas ya fueron aplicados." };

  const baseDate = (() => {
    for (const t of temas) {
      if (t.fecha) {
        const d = new Date(t.fecha);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return new Date();
  })();

  const rows = pendingIdxs.map((idx, offset) =>
    buildPubRow({
      cliente_id: plan.cliente_id,
      plan_id: plan.id,
      tema: temas[idx],
      tema_idx: idx,
      plan_label: plan.periodo_label,
      base_date: baseDate,
      fallback_offset: offset,
      user_id: user.id,
    })
  );

  const { data: inserted, error: insertErr } = await admin
    .from("publications")
    .insert(rows)
    .select("id");
  if (insertErr) return { ok: false, error: insertErr.message };

  await admin
    .from("client_content_plans")
    .update({
      applied_temas_indices: [...applied, ...pendingIdxs],
      applied_at: new Date().toISOString(),
      applied_count: (plan.applied_temas_indices?.length ?? 0) + pendingIdxs.length,
    })
    .eq("id", planId);

  revalidatePath(`/clientes/${plan.cliente_id}/plan-mensual`);
  revalidatePath(`/contenidos`);
  return { ok: true, data: { created: inserted?.length ?? rows.length } };
}
