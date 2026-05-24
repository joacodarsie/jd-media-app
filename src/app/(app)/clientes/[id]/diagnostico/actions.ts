"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import type { DiagnosticContent } from "@/lib/diagnostics/schema";
import { isDiagnosticShape } from "@/lib/diagnostics/schema";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Guarda los cambios manuales del editor en el draft.
 */
export async function saveDiagnosticDraft(
  diagnosticId: string,
  content: DiagnosticContent
): Promise<ActionResult> {
  await requireUser();
  if (!isDiagnosticShape(content)) {
    return { ok: false, error: "Contenido inválido." };
  }

  const supabase = createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("client_diagnostics")
    .select("id, cliente_id, status")
    .eq("id", diagnosticId)
    .maybeSingle();
  if (fetchErr || !existing) return { ok: false, error: "Diagnóstico no encontrado." };
  if (existing.status !== "draft") {
    return { ok: false, error: "Solo se pueden editar drafts." };
  }

  const { error: updateErr } = await supabase
    .from("client_diagnostics")
    .update({ content: content as unknown as Record<string, unknown> })
    .eq("id", diagnosticId);
  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath(`/clientes/${existing.cliente_id}/diagnostico`);
  return { ok: true };
}

/**
 * Aprueba el draft → status = 'approved'.
 * Archiva versiones aprobadas anteriores del mismo cliente.
 * Marca el paso diagnostico_generado_at en client_onboarding.
 */
export async function approveDiagnostic(diagnosticId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = createClient();
  const admin = createAdmin();

  const { data: diag, error: fetchErr } = await supabase
    .from("client_diagnostics")
    .select("id, cliente_id, status")
    .eq("id", diagnosticId)
    .maybeSingle();
  if (fetchErr || !diag) return { ok: false, error: "Diagnóstico no encontrado." };
  if (diag.status !== "draft") return { ok: false, error: "Ya está aprobado o archivado." };

  // Archivar aprobadas anteriores.
  await admin
    .from("client_diagnostics")
    .update({ status: "archived" })
    .eq("cliente_id", diag.cliente_id)
    .eq("status", "approved");

  const now = new Date().toISOString();
  const { error: approveErr } = await admin
    .from("client_diagnostics")
    .update({
      status: "approved",
      approved_at: now,
      approved_by: user.id,
    })
    .eq("id", diagnosticId);
  if (approveErr) return { ok: false, error: approveErr.message };

  // Marcar paso en onboarding (upsert, sin pisar si ya estaba).
  await admin
    .from("client_onboarding")
    .upsert(
      { cliente_id: diag.cliente_id, diagnostico_generado_at: now },
      { onConflict: "cliente_id", ignoreDuplicates: false }
    );

  revalidatePath(`/clientes/${diag.cliente_id}/diagnostico`);
  revalidatePath(`/clientes/${diag.cliente_id}/onboarding`);
  return { ok: true };
}

/**
 * Convierte el plan_accion del diagnóstico aprobado en tareas del cliente.
 * Idempotente: no vuelve a correr si ya se hizo.
 */
const AREA_TO_TASK_AREA: Record<string, string> = {
  diseno: "Diseño",
  community: "Community Manager",
  produccion: "Edición Audiovisual",
  paid: "Paid Media",
  estrategia: "Estrategia/Dirección",
  desarrollo: "Desarrollo Web",
  otro: "Coordinación",
};

export async function convertPlanToTasks(diagnosticId: string): Promise<ActionResult<{ created: number }>> {
  const user = await requireUser();
  const admin = createAdmin();

  const { data: diag, error: fetchErr } = await admin
    .from("client_diagnostics")
    .select("id, cliente_id, status, content, tasks_created_at")
    .eq("id", diagnosticId)
    .maybeSingle();
  if (fetchErr || !diag) return { ok: false, error: "Diagnóstico no encontrado." };
  if (diag.status !== "approved") return { ok: false, error: "El diagnóstico tiene que estar aprobado." };
  if (diag.tasks_created_at) return { ok: false, error: "Las tareas ya fueron creadas para este diagnóstico." };

  const content = diag.content as unknown as DiagnosticContent;
  const plan = Array.isArray(content?.plan_accion) ? content.plan_accion : [];
  if (plan.length === 0) return { ok: false, error: "No hay acciones en el plan." };

  const rows = plan.map((action) => ({
    cliente_id: diag.cliente_id,
    titulo: action.titulo,
    descripcion: `${action.descripcion}\n\n_Generado desde el diagnóstico inicial._`,
    area: AREA_TO_TASK_AREA[action.area_sugerida] ?? "Estrategia/Dirección",
    prioridad: action.prioridad ?? "media",
    estado: "pendiente",
    creado_por_id: user.id,
  }));

  const { error: insertErr, data: inserted } = await admin
    .from("tasks")
    .insert(rows)
    .select("id");
  if (insertErr) return { ok: false, error: insertErr.message };

  await admin
    .from("client_diagnostics")
    .update({
      tasks_created_at: new Date().toISOString(),
      tasks_created_count: inserted?.length ?? rows.length,
    })
    .eq("id", diagnosticId);

  revalidatePath(`/clientes/${diag.cliente_id}/diagnostico`);
  revalidatePath(`/tareas`);
  return { ok: true, data: { created: inserted?.length ?? rows.length } };
}

/**
 * Archiva un diagnóstico (no se borra, queda en historial).
 */
export async function archiveDiagnostic(diagnosticId: string): Promise<ActionResult> {
  await requireUser();
  const admin = createAdmin();
  const { data: diag } = await admin
    .from("client_diagnostics")
    .select("cliente_id")
    .eq("id", diagnosticId)
    .maybeSingle();
  if (!diag) return { ok: false, error: "No encontrado." };

  const { error } = await admin
    .from("client_diagnostics")
    .update({ status: "archived" })
    .eq("id", diagnosticId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clientes/${diag.cliente_id}/diagnostico`);
  return { ok: true };
}
