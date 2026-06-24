"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod } from "@/lib/finanzas";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import { friendlyAiError } from "@/lib/ai/errors";
import {
  proposePayrollAdjustments,
  type ProposedAdjustment,
} from "@/lib/payroll-adjustments";

const PATH = "/coordinacion/sueldos";

export async function addPayrollItem(input: {
  userId: string;
  periodo: string;
  tipo: "comision" | "extra" | "ajuste";
  concepto: string;
  monto: number;
  clienteId?: string | null;
  notas?: string | null;
}) {
  const me = await requireRole(["admin"]);
  if (!input.userId || !input.concepto.trim()) {
    return { error: "Faltan datos (persona y concepto)." };
  }
  if (!Number.isFinite(input.monto) || input.monto === 0) {
    return { error: "El monto debe ser distinto de cero." };
  }
  const admin = createAdmin();
  const { error } = await admin.from("payroll_items").insert({
    user_id: input.userId,
    periodo: input.periodo,
    tipo: input.tipo,
    concepto: input.concepto.trim(),
    monto: input.monto,
    cliente_id: input.clienteId ?? null,
    notas: input.notas ?? null,
    creado_por_id: me.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function updatePayrollItem(input: {
  id: string;
  concepto: string;
  monto: number;
  clienteId?: string | null;
}) {
  await requireRole(["admin"]);
  if (!input.id || !input.concepto.trim()) {
    return { error: "Faltan datos (concepto)." };
  }
  if (!Number.isFinite(input.monto) || input.monto === 0) {
    return { error: "El monto debe ser distinto de cero." };
  }
  const admin = createAdmin();
  const { error } = await admin
    .from("payroll_items")
    .update({
      concepto: input.concepto.trim(),
      monto: input.monto,
      cliente_id: input.clienteId ?? null,
    })
    .eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deletePayrollItem(id: string) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const { error } = await admin.from("payroll_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Registra el sueldo del período como un pago al equipo (Finanzas → team_payments),
 * para que entre al cashflow. Idempotente por persona+período+concepto: si ya
 * existe, no duplica.
 */
export async function registerSalaryPayment(input: {
  userId: string;
  periodo: string;
  monto: number;
  concepto: string;
}) {
  const me = await requireRole(["admin"]);
  const admin = createAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await admin
    .from("team_payments")
    .select("id")
    .eq("user_id", input.userId)
    .eq("periodo", input.periodo)
    .eq("concepto", input.concepto)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("team_payments")
      .update({ monto: input.monto })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath(PATH);
    revalidatePath("/finanzas");
    return { ok: true, updated: true };
  }

  const { error } = await admin.from("team_payments").insert({
    user_id: input.userId,
    periodo: input.periodo,
    concepto: input.concepto,
    monto: input.monto,
    moneda: "ARS",
    fecha_programada: today,
    creado_por_id: me.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath("/finanzas");
  return { ok: true };
}

/**
 * Define el reparto EXCEPCIONAL de la comisión de coordinación para un mes.
 * `split` son fracciones del pool (deberían sumar ~1). Pasar [] (vacío) vuelve
 * al comportamiento por defecto (todo a la coordinadora de cada cuenta).
 */
export async function setCoordinationSplit(input: {
  periodo: string;
  split: { userId: string; pct: number }[];
}) {
  await requireRole(["admin"]);
  if (!/^\d{4}-\d{2}$/.test(input.periodo)) return { error: "Período inválido." };
  const admin = createAdmin();

  // Reemplazo total: borro el reparto anterior del mes y cargo el nuevo.
  const { error: delErr } = await admin
    .from("payroll_coordination_splits")
    .delete()
    .eq("periodo", input.periodo);
  if (delErr) {
    if ((delErr as { code?: string }).code === "42P01")
      return { error: "Falta aplicar la migración 0103." };
    return { error: delErr.message };
  }

  const rows = (input.split ?? [])
    .filter((s) => s.userId && Number.isFinite(s.pct) && s.pct > 0)
    .map((s) => ({ periodo: input.periodo, user_id: s.userId, pct: s.pct }));

  if (rows.length > 0) {
    const { error } = await admin.from("payroll_coordination_splits").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath(PATH);
  return { ok: true as const };
}

/**
 * Asistente de nómina: traduce una instrucción en criollo a ítems propuestos
 * (extras/ajustes). NO persiste nada — devuelve la propuesta para que el admin
 * la revise y confirme con `applyAdjustments`.
 */
export async function proposeAdjustments(input: { periodo?: string; instrucciones: string }) {
  await requireRole(["admin"]);
  const instrucciones = input.instrucciones.trim();
  if (!instrucciones) return { error: "Escribí qué ajustes querés cargar." };

  const periodo = input.periodo && /^\d{4}-\d{2}$/.test(input.periodo) ? input.periodo : currentPeriod();
  const admin = createAdmin();
  const { people, clientOptions } = await buildPeriodPayroll(admin, periodo);

  const team = people.map((p) => ({
    userId: p.userId,
    nombre: p.nombre,
    rol: p.rol,
    total: p.total,
  }));
  const clients = clientOptions.map((c) => ({ id: c.id, nombre: c.nombre }));

  let proposal;
  try {
    proposal = await proposePayrollAdjustments(instrucciones, team, clients);
  } catch (e) {
    console.error("proposePayrollAdjustments:", e);
    return { error: friendlyAiError(e) };
  }
  if (!proposal) return { error: "La IA no devolvió una propuesta válida. Probá reformular." };
  if (proposal.items.length === 0) {
    return { error: "No pude identificar ningún ajuste claro. Probá nombrar a la persona y el monto." };
  }
  return { ok: true as const, items: proposal.items, nota: proposal.nota };
}

/** Aplica los ítems propuestos (ya revisados por el admin) a payroll_items. */
export async function applyAdjustments(input: {
  periodo: string;
  items: ProposedAdjustment[];
}) {
  const me = await requireRole(["admin"]);
  const items = (input.items ?? []).filter(
    (it) => it.userId && it.concepto.trim() && Number.isFinite(it.monto) && it.monto !== 0
  );
  if (items.length === 0) return { error: "No hay ítems para aplicar." };

  const admin = createAdmin();
  const { error } = await admin.from("payroll_items").insert(
    items.map((it) => ({
      user_id: it.userId,
      periodo: input.periodo,
      tipo: it.tipo,
      concepto: it.concepto.trim(),
      monto: Math.round(it.monto),
      cliente_id: it.clienteId ?? null,
      creado_por_id: me.id,
    }))
  );
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true as const, count: items.length };
}
