"use server";

import { revalidatePath } from "next/cache";
import { requireUser, canAccessClient } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { loadMeetingContext } from "@/lib/monthly-diagnostics/context";
import { generateMeetingGuion } from "@/lib/monthly-diagnostics/guion";
import { generateClientReport } from "@/lib/monthly-diagnostics/client-report";
import { normalizeMonthlyDiagnostic } from "@/lib/monthly-diagnostics/schema";
import { hoyYmd } from "@/lib/dates";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const AREA_TO_TASK_AREA: Record<string, string> = {
  diseno: "Diseño",
  community: "Community Manager",
  produccion: "Edición Audiovisual",
  paid: "Paid Media",
  estrategia: "Estrategia/Dirección",
  desarrollo: "Desarrollo Web",
  otro: "Coordinación",
};

async function assertAccess(clienteId: string) {
  const me = await requireUser();
  const ok = await canAccessClient(me.id, me.rol, clienteId, me.rol_secundario);
  if (!ok) throw new Error("Sin acceso a este cliente.");
  return me;
}

function validPeriodo(p: string): boolean {
  return /^\d{4}-\d{2}$/.test(p);
}

/**
 * Arma el guión de la reunión mensual y lo guarda en el reporte del mes
 * (client_monthly_reports.ai_meet_guion — misma columna que usa el reporte,
 * para no tener dos guiones distintos del mismo meet dando vueltas).
 */
export async function generarGuionReunion(
  clienteId: string,
  periodo: string
): Promise<ActionResult<{ texto: string }>> {
  const me = await assertAccess(clienteId);
  if (!validPeriodo(periodo)) return { ok: false, error: "Mes inválido." };

  const ctx = await loadMeetingContext(clienteId, periodo);
  const texto = await generateMeetingGuion(ctx);
  if (!texto) return { ok: false, error: "No se pudo generar el guión. Reintentá en un rato." };

  const { error } = await createAdmin().from("client_monthly_reports").upsert(
    {
      cliente_id: clienteId,
      year_month: periodo,
      ai_meet_guion: texto,
      ai_meet_guion_at: new Date().toISOString(),
      created_by_id: me.id,
    },
    { onConflict: "cliente_id,year_month" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clientes/${clienteId}/reunion`);
  revalidatePath(`/reporte/cliente/${clienteId}`);
  return { ok: true, data: { texto } };
}

/**
 * Rehace el informe que se le manda al cliente, sin tocar el diagnóstico
 * interno. Se usa cuando el texto no convence: el análisis está bien pero la
 * redacción no.
 */
export async function rehacerInformeCliente(
  clienteId: string,
  periodo: string
): Promise<ActionResult> {
  await assertAccess(clienteId);
  if (!validPeriodo(periodo)) return { ok: false, error: "Mes inválido." };

  const admin = createAdmin();
  const { data: row, error: fetchErr } = await admin
    .from("client_monthly_diagnostics")
    .select("id, content")
    .eq("cliente_id", clienteId)
    .eq("periodo", periodo)
    .maybeSingle();
  if (fetchErr || !row) {
    return { ok: false, error: "Todavía no hay diagnóstico de ese mes." };
  }

  const diagnostico = normalizeMonthlyDiagnostic((row as { content: unknown }).content);
  const ctx = await loadMeetingContext(clienteId, periodo);
  const informe = await generateClientReport(ctx, diagnostico);
  if (!informe) {
    return { ok: false, error: "No se pudo armar el informe. Reintentá en un rato." };
  }

  const { error } = await admin
    .from("client_monthly_diagnostics")
    .update({
      client_report: informe as unknown as Record<string, unknown>,
      client_report_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", (row as { id: string }).id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clientes/${clienteId}/reunion`);
  return { ok: true };
}

/**
 * Deja registrado que el informe se le compartió al cliente.
 */
export async function marcarInformeCompartido(
  clienteId: string,
  periodo: string
): Promise<ActionResult> {
  await assertAccess(clienteId);
  if (!validPeriodo(periodo)) return { ok: false, error: "Mes inválido." };

  const { error } = await createAdmin()
    .from("client_monthly_diagnostics")
    .update({ shared_at: new Date().toISOString() })
    .eq("cliente_id", clienteId)
    .eq("periodo", periodo);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clientes/${clienteId}/reunion`);
  return { ok: true };
}

/**
 * Pasa las acciones del mes que viene a tareas reales del equipo.
 */
export async function accionesATareas(
  clienteId: string,
  periodo: string
): Promise<ActionResult<{ created: number }>> {
  const me = await assertAccess(clienteId);
  if (!validPeriodo(periodo)) return { ok: false, error: "Mes inválido." };

  const admin = createAdmin();
  const { data: row, error: fetchErr } = await admin
    .from("client_monthly_diagnostics")
    .select("id, content, tasks_created_at")
    .eq("cliente_id", clienteId)
    .eq("periodo", periodo)
    .maybeSingle();
  if (fetchErr || !row) return { ok: false, error: "No hay diagnóstico de ese mes." };
  if ((row as { tasks_created_at: string | null }).tasks_created_at) {
    return { ok: false, error: "Las tareas de este mes ya fueron creadas." };
  }

  const content = normalizeMonthlyDiagnostic((row as { content: unknown }).content);
  const acciones = content.acciones_proximo_mes;
  if (acciones.length === 0) return { ok: false, error: "No hay acciones para pasar." };

  const rows = acciones.map((a) => ({
    cliente_id: clienteId,
    titulo: a.titulo,
    descripcion: `${a.descripcion}\n\n_Generado desde el diagnóstico mensual de ${periodo}._`,
    area: AREA_TO_TASK_AREA[a.area_sugerida] ?? "Estrategia/Dirección",
    prioridad: a.prioridad,
    estado: "pendiente",
    creado_por_id: me.id,
  }));

  const { data: inserted, error: insertErr } = await admin
    .from("tasks")
    .insert(rows)
    .select("id");
  if (insertErr) return { ok: false, error: insertErr.message };

  await admin
    .from("client_monthly_diagnostics")
    .update({
      tasks_created_at: new Date().toISOString(),
      tasks_created_count: inserted?.length ?? rows.length,
    })
    .eq("id", (row as { id: string }).id);

  revalidatePath(`/clientes/${clienteId}/reunion`);
  revalidatePath("/tareas");
  return { ok: true, data: { created: inserted?.length ?? rows.length } };
}

/**
 * Registra la reunión del mes sin pasar por la transcripción (por si el meet
 * se hizo pero todavía no se cargó el audio/PDF).
 */
export async function registrarReunion(
  clienteId: string,
  periodo: string,
  notas?: string | null
): Promise<ActionResult> {
  const me = await assertAccess(clienteId);
  if (!validPeriodo(periodo)) return { ok: false, error: "Mes inválido." };

  const { error } = await createAdmin().from("client_meetings").upsert(
    {
      cliente_id: clienteId,
      periodo,
      fecha: hoyYmd(),
      notas: notas?.trim() || null,
      registrado_por: me.id,
    },
    { onConflict: "cliente_id,periodo" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clientes/${clienteId}/reunion`);
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}
