"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

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
